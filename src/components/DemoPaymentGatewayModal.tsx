import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  QrCode,
  Smartphone,
  CreditCard,
  Building2,
  ArrowRight,
  Sparkles,
  Lock,
} from 'lucide-react';

interface DemoPaymentGatewayModalProps {
  isOpen: boolean;
  onClose: () => void;
  amountInRupees: number;
  customerName: string;
  customerPhone: string;
  onPaymentSuccess: (paymentId: string) => void;
}

export const DemoPaymentGatewayModal: React.FC<DemoPaymentGatewayModalProps> = ({
  isOpen,
  onClose,
  amountInRupees,
  customerName,
  customerPhone,
  onPaymentSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'upi' | 'card' | 'netbanking'>('upi');
  const [selectedUpiApp, setSelectedUpiApp] = useState<'gpay' | 'phonepe' | 'paytm' | 'qr'>('qr');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStep, setProcessStep] = useState<string>('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [generatedPaymentId, setGeneratedPaymentId] = useState('');

  useEffect(() => {
    if (isOpen) {
      setIsProcessing(false);
      setIsSuccess(false);
      setProcessStep('');
      setGeneratedPaymentId(`pay_demo_${Date.now().toString(36)}`);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSimulatePayment = (methodName: string) => {
    setIsProcessing(true);
    setProcessStep(`Connecting to ${methodName}...`);

    setTimeout(() => {
      setProcessStep('Awaiting approval from UPI / Bank server...');
    }, 600);

    setTimeout(() => {
      setProcessStep('Payment approved! Generating payment receipt...');
    }, 1300);

    setTimeout(() => {
      setIsProcessing(false);
      setIsSuccess(true);
      setTimeout(() => {
        onPaymentSuccess(generatedPaymentId);
      }, 1000);
    }, 1900);
  };

  return (
    <div className="fixed inset-0 z-60 overflow-y-auto bg-stone-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-[#DFB24E]/40 overflow-hidden animate-scale-in">
        {/* Top Header */}
        <div className="bg-[#2B0B0E] p-4 text-white flex items-center justify-between border-b border-[#DFB24E]/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#801323] border border-[#DFB24E]/40 flex items-center justify-center text-[#DFB24E] shadow-xs">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#DFB24E] uppercase tracking-wider">
                  Online Payment Gateway
                </span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Demo Sandbox
                </span>
              </div>
              <h3 className="font-serif text-lg font-bold text-white">
                Mantasha Biryani House
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="p-1.5 text-stone-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors disabled:opacity-30 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Amount Strip */}
        <div className="bg-[#FAF7F2] px-5 py-3 border-b border-[#EAE2D6] flex items-center justify-between">
          <div>
            <span className="text-xs text-stone-500 block">Total Amount Payable</span>
            <span className="text-xs font-medium text-stone-700">Order for {customerName || 'Customer'}</span>
          </div>
          <div className="text-right">
            <span className="font-mono text-2xl font-bold text-[#801323]">
              ₹{amountInRupees}
            </span>
          </div>
        </div>

        {/* Main Content / Success State */}
        {isSuccess ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div className="space-y-1">
              <h4 className="font-serif text-xl font-bold text-stone-900">
                Payment Successful!
              </h4>
              <p className="text-xs text-stone-600">
                ₹{amountInRupees} received successfully via Online Gateway.
              </p>
              <p className="font-mono text-[11px] text-stone-400 mt-2 bg-stone-100 p-2 rounded-lg inline-block">
                Ref ID: {generatedPaymentId}
              </p>
            </div>
            <p className="text-xs font-semibold text-[#801323] animate-pulse">
              Finalizing order and redirecting to confirmation...
            </p>
          </div>
        ) : isProcessing ? (
          <div className="p-10 text-center space-y-5">
            <div className="w-14 h-14 rounded-full border-4 border-[#801323]/20 border-t-[#801323] animate-spin mx-auto" />
            <div className="space-y-2">
              <h4 className="font-serif text-lg font-bold text-stone-800">
                Processing Demo Payment...
              </h4>
              <p className="text-xs text-[#801323] font-semibold bg-[#FAF7F2] p-2.5 rounded-xl border border-[#EAE2D6]">
                {processStep}
              </p>
              <p className="text-[11px] text-stone-400">
                Please do not close this window or refresh the page.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-5 sm:p-6 space-y-5">
            {/* Method Tabs */}
            <div className="flex border-b border-[#EAE2D6] gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('upi')}
                className={`pb-2.5 text-xs font-bold transition-colors relative flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'upi'
                    ? 'text-[#801323] border-b-2 border-[#801323]'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>UPI / QR Code</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('card')}
                className={`pb-2.5 text-xs font-bold transition-colors relative flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'card'
                    ? 'text-[#801323] border-b-2 border-[#801323]'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>Test Cards</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('netbanking')}
                className={`pb-2.5 text-xs font-bold transition-colors relative flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'netbanking'
                    ? 'text-[#801323] border-b-2 border-[#801323]'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>Net Banking</span>
              </button>
            </div>

            {/* TAB 1: UPI & QR CODE */}
            {activeTab === 'upi' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedUpiApp('qr')}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      selectedUpiApp === 'qr'
                        ? 'border-[#801323] bg-rose-50/50 shadow-2xs font-bold text-[#801323]'
                        : 'border-[#EAE2D6] text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    <QrCode className="w-5 h-5 mx-auto mb-1 text-[#801323]" />
                    <span className="text-xs block">Scan QR</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedUpiApp('gpay')}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      selectedUpiApp === 'gpay'
                        ? 'border-[#801323] bg-rose-50/50 shadow-2xs font-bold text-[#801323]'
                        : 'border-[#EAE2D6] text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    <div className="w-5 h-5 mx-auto mb-1 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center">
                      G
                    </div>
                    <span className="text-xs block">Google Pay</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedUpiApp('phonepe')}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      selectedUpiApp === 'phonepe'
                        ? 'border-[#801323] bg-rose-50/50 shadow-2xs font-bold text-[#801323]'
                        : 'border-[#EAE2D6] text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    <div className="w-5 h-5 mx-auto mb-1 rounded-full bg-purple-600 text-white font-bold text-[10px] flex items-center justify-center">
                      Pe
                    </div>
                    <span className="text-xs block">PhonePe</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedUpiApp('paytm')}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      selectedUpiApp === 'paytm'
                        ? 'border-[#801323] bg-rose-50/50 shadow-2xs font-bold text-[#801323]'
                        : 'border-[#EAE2D6] text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    <div className="w-5 h-5 mx-auto mb-1 rounded-full bg-cyan-600 text-white font-bold text-[10px] flex items-center justify-center">
                      P
                    </div>
                    <span className="text-xs block">Paytm UPI</span>
                  </button>
                </div>

                {selectedUpiApp === 'qr' ? (
                  <div className="bg-[#FAF7F2] p-4 rounded-xl border border-[#EAE2D6] text-center space-y-3">
                    <div className="w-36 h-36 bg-white p-2 rounded-xl border-2 border-stone-800 mx-auto shadow-sm flex flex-col items-center justify-center relative">
                      {/* Stylized QR Code Representation */}
                      <div className="grid grid-cols-5 gap-1 w-full h-full p-2">
                        <div className="bg-stone-900 rounded-xs" />
                        <div className="bg-stone-900 rounded-xs" />
                        <div className="bg-stone-900 rounded-xs" />
                        <div className="bg-stone-300 rounded-xs" />
                        <div className="bg-stone-900 rounded-xs" />
                        <div className="bg-stone-900 rounded-xs" />
                        <div className="bg-white rounded-xs" />
                        <div className="bg-stone-900 rounded-xs" />
                        <div className="bg-stone-900 rounded-xs" />
                        <div className="bg-stone-900 rounded-xs" />
                        <div className="bg-stone-900 rounded-xs" />
                        <div className="bg-stone-900 rounded-xs" />
                        <div className="bg-rose-900 rounded-xs flex items-center justify-center text-[7px] text-white font-bold">
                          M
                        </div>
                        <div className="bg-stone-900 rounded-xs" />
                        <div className="bg-stone-900 rounded-xs" />
                        <div className="bg-stone-300 rounded-xs" />
                        <div className="bg-stone-900 rounded-xs" />
                        <div className="bg-stone-900 rounded-xs" />
                        <div className="bg-white rounded-xs" />
                        <div className="bg-stone-900 rounded-xs" />
                        <div className="bg-stone-900 rounded-xs" />
                        <div className="bg-stone-900 rounded-xs" />
                        <div className="bg-stone-900 rounded-xs" />
                        <div className="bg-stone-900 rounded-xs" />
                        <div className="bg-stone-900 rounded-xs" />
                      </div>
                    </div>
                    <div className="text-xs text-stone-600">
                      <p className="font-semibold text-stone-800">
                        Scan with Any UPI App (GPay / PhonePe / Paytm / BHIM)
                      </p>
                      <p className="text-[11px] text-stone-500 font-mono mt-0.5">
                        UPI ID: mantashabiryani@upi
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSimulatePayment('UPI QR Code')}
                      className="w-full py-3 px-4 bg-[#801323] hover:bg-[#680E19] text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4 text-[#DFB24E]" />
                      <span>Simulate QR Payment (₹{amountInRupees})</span>
                    </button>
                  </div>
                ) : (
                  <div className="bg-[#FAF7F2] p-4 rounded-xl border border-[#EAE2D6] space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-stone-800">Direct App Payment</span>
                      <span className="font-mono text-stone-500">{customerPhone || '9876543210'}@upi</span>
                    </div>
                    <p className="text-xs text-stone-600 leading-relaxed">
                      Instant one-click demo payment using {selectedUpiApp.toUpperCase()}. No OTP or bank debit required in test mode.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleSimulatePayment(`${selectedUpiApp.toUpperCase()} UPI`)}
                      className="w-full py-3 px-4 bg-[#801323] hover:bg-[#680E19] text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>Pay ₹{amountInRupees} via {selectedUpiApp.toUpperCase()}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: TEST CARDS */}
            {activeTab === 'card' && (
              <div className="space-y-4">
                <div className="p-3.5 bg-stone-900 text-white rounded-xl space-y-3 font-mono text-xs shadow-md">
                  <div className="flex justify-between items-center text-stone-400 text-[10px]">
                    <span>RAZORPAY TEST CARD</span>
                    <span className="text-[#DFB24E] font-bold">VISA</span>
                  </div>
                  <div className="text-sm tracking-widest font-bold">
                    4111 2222 3333 4444
                  </div>
                  <div className="flex justify-between text-[11px] text-stone-300">
                    <div>
                      <span className="text-[9px] text-stone-500 block">CARD HOLDER</span>
                      <span>{customerName || 'MANTASHA GUEST'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-stone-500 block">EXPIRES</span>
                      <span>12/28</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-stone-500 block">CVV</span>
                      <span>123</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleSimulatePayment('Razorpay Test Visa Card')}
                  className="w-full py-3.5 px-4 bg-[#801323] hover:bg-[#680E19] text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Pay ₹{amountInRupees} with Test Card</span>
                </button>
              </div>
            )}

            {/* TAB 3: NET BANKING */}
            {activeTab === 'netbanking' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {['State Bank of India', 'HDFC Bank', 'ICICI Bank', 'Axis Bank'].map((bank) => (
                    <button
                      key={bank}
                      type="button"
                      onClick={() => handleSimulatePayment(bank)}
                      className="p-3 border border-[#EAE2D6] rounded-xl text-left hover:border-[#801323] hover:bg-rose-50/40 transition-all font-semibold text-stone-800 flex items-center justify-between cursor-pointer"
                    >
                      <span>{bank}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-stone-400" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Bottom Security Assurance */}
            <div className="pt-2 border-t border-[#EAE2D6] flex items-center justify-between text-[11px] text-stone-500">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>256-Bit SSL Demo Sandbox</span>
              </span>
              <span className="flex items-center gap-1 text-[#801323] font-medium">
                <Sparkles className="w-3 h-3 text-[#DFB24E]" />
                <span>Zero Real Money Charged</span>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
