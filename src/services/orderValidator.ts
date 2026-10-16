import { MenuItem, OrderItemRecord, CustomerDetails } from '../types';

export interface OrderValidationResult {
  isValid: boolean;
  errors: string[];
  calculatedSubtotal: number;
  calculatedDeliveryFee: number;
  calculatedPackagingFee: number;
  calculatedTotal: number;
  validatedItems: OrderItemRecord[];
}

export const MINIMUM_SUBTOTAL = 150;
export const FREE_DELIVERY_THRESHOLD = 499;
export const STANDARD_DELIVERY_FEE = 40;
export const PACKAGING_FEE = 0; // Transparent zero hidden packaging charge for customer trust

/**
 * Server-side authoritative validation and price calculation.
 * Prevents client-side price tampering by fetching prices strictly from authoritative menu items.
 */
export function validateAndCalculateOrder(
  cartItems: { menuItemId: string; quantity: number }[],
  customer: CustomerDetails,
  authoritativeMenu: MenuItem[]
): OrderValidationResult {
  const errors: string[] = [];

  // 1. Validate Customer Info
  if (!customer.name || customer.name.trim().length < 2) {
    errors.push('Customer full name must be at least 2 characters.');
  }

  // Clean 10-digit Indian phone number
  const cleanPhone = customer.phone.replace(/[^0-9]/g, '');
  const isValidIndianPhone =
    cleanPhone.length === 10 ||
    (cleanPhone.length === 12 && cleanPhone.startsWith('91'));
  if (!isValidIndianPhone) {
    errors.push('Please enter a valid 10-digit Indian mobile number (e.g., 9835012345).');
  }

  if (!customer.address || customer.address.trim().length < 6) {
    errors.push('Delivery address must be specified with street or house details (minimum 6 characters).');
  }

  if (!customer.landmark || customer.landmark.trim().length < 2) {
    errors.push('Please provide a nearby landmark in Bhagalpur (e.g., Near Tilkamanjhi Chowk, Station Road, Ghantaghar).');
  }

  // 2. Validate Items & Recalculate Subtotal
  if (!cartItems || cartItems.length === 0) {
    errors.push('Your cart is empty. Please add items before placing an order.');
    return {
      isValid: false,
      errors,
      calculatedSubtotal: 0,
      calculatedDeliveryFee: 0,
      calculatedPackagingFee: 0,
      calculatedTotal: 0,
      validatedItems: [],
    };
  }

  const validatedItems: OrderItemRecord[] = [];
  let calculatedSubtotal = 0;

  for (const item of cartItems) {
    if (!item.quantity || item.quantity <= 0) {
      continue;
    }

    const menuItem = authoritativeMenu.find((m) => m.id === item.menuItemId);
    if (!menuItem) {
      errors.push(`Item ID ${item.menuItemId} is no longer available on our menu.`);
      continue;
    }

    if (!menuItem.is_available) {
      errors.push(`"${menuItem.name}" is currently sold out in the kitchen.`);
      continue;
    }

    const itemSubtotal = menuItem.price * item.quantity;
    calculatedSubtotal += itemSubtotal;

    validatedItems.push({
      menuItemId: menuItem.id,
      name: menuItem.name,
      price: menuItem.price, // strictly authoritative price
      quantity: item.quantity,
      is_veg: menuItem.is_veg,
      subtotal: itemSubtotal,
    });
  }

  if (validatedItems.length === 0) {
    errors.push('No valid available items found in cart.');
  }

  // Minimum order subtotal ₹150
  if (calculatedSubtotal < MINIMUM_SUBTOTAL) {
    errors.push(`Minimum order subtotal is ₹${MINIMUM_SUBTOTAL}. Please add more items.`);
  }

  // Calculate Delivery Fee (Free above threshold)
  const calculatedDeliveryFee =
    calculatedSubtotal >= FREE_DELIVERY_THRESHOLD ? 0 : STANDARD_DELIVERY_FEE;
  const calculatedPackagingFee = PACKAGING_FEE;
  const calculatedTotal =
    calculatedSubtotal + calculatedDeliveryFee + calculatedPackagingFee;

  return {
    isValid: errors.length === 0,
    errors,
    calculatedSubtotal,
    calculatedDeliveryFee,
    calculatedPackagingFee,
    calculatedTotal,
    validatedItems,
  };
}

/**
 * Generates a human-friendly unique order reference ID: MB-YYYY-XXXX
 */
export function generateOrderNumber(): string {
  const year = new Date().getFullYear();
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `MB-${year}-${randomSuffix}`;
}
