import React, { useState } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, DollarSign, Calendar, Store, CreditCard, Download, Sparkles, Plus } from 'lucide-react';

interface ReceiptData {
  Filename: string;
  Engine: string;
  Merchant: string;
  Date: string;
  Subtotal: string;
  Tax: string;
  Total_Amount: string;
  Payment_Method: string;
}

interface ReceiptOCRProps {
  onAddPosTransaction?: (transaction: any) => void;
}

export default function ReceiptOCR({ onAddPosTransaction }: ReceiptOCRProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<ReceiptData | null>(null);
  const [rawText, setRawText] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [batchHistory, setBatchHistory] = useState<ReceiptData[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    const formData = new FormData();
    formData.append('receipt', file);

    try {
      const response = await fetch('/ocr-api/api/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setExtractedData(result.data);
        setRawText(result.raw_text);
        setBatchHistory((prev) => [result.data, ...prev]);

        // Automatically pass to POS transactions if callback provided
        if (onAddPosTransaction && result.data.Total_Amount !== 'N/A' && result.data.Total_Amount !== '') {
          onAddPosTransaction({
            transactionId: `TXN-${Date.now().toString().slice(-6)}`,
            date: result.data.Date !== 'N/A' ? result.data.Date : new Date().toISOString().split('T')[0],
            storeId: 'ST-001',
            storeName: result.data.Merchant !== 'Unknown Merchant' ? result.data.Merchant : 'Scanned Store',
            category: 'Scanned Expense',
            totalAmount: parseFloat(result.data.Total_Amount) || 0,
            paymentMethod: result.data.Payment_Method !== 'N/A' ? result.data.Payment_Method : 'Cash',
          });
        }
      } else {
        setError(result.error || 'Failed to process receipt OCR');
      }
    } catch (err: any) {
      setError('Could not connect to OCR backend server (Ensure python ocr_server.py is running on port 5000)');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="bg-[#0a0b0e] border border-white/10 rounded-2xl p-6 lg:p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#8cff2e]/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold webstacked-badge-lime uppercase tracking-wider">
                Smart OCR v2.0
              </span>
              <span className="text-xs text-slate-400 font-medium">Supports PDF, JPG, PNG & Handwriting</span>
            </div>
            <h2 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
              Receipt & Invoice <span className="text-[#8cff2e]">Intelligence Engine</span>
            </h2>
            <p className="text-sm text-slate-400 max-w-xl mt-1">
              Upload printed or handwritten receipts. EasyOCR automatically extracts Merchants, Line Items, Taxes, and Totals into InsightOS analytics.
            </p>
          </div>

          <a
            href="/ocr-api/api/download-csv"
            target="_blank"
            rel="noreferrer"
            className="px-5 py-3 rounded-xl bg-[#12141a] hover:bg-[#1a1d26] text-white border border-white/10 text-xs font-bold flex items-center gap-2 transition-all hover:border-[#8cff2e]/50 shadow-lg"
          >
            <Download className="w-4 h-4 text-[#8cff2e]" />
            <span>Export Receipts CSV</span>
          </a>
        </div>
      </div>

      {/* Upload Zone & Extraction Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Drop Zone Box */}
        <div className="lg:col-span-5 space-y-4">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => document.getElementById('receipt-file-input')?.click()}
            className="bg-[#0a0b0e] border-2 border-dashed border-white/15 hover:border-[#8cff2e]/60 rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 group shadow-xl relative overflow-hidden"
          >
            <input
              type="file"
              id="receipt-file-input"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={handleFileChange}
            />

            <div className="w-16 h-16 rounded-2xl bg-[#12141a] border border-white/10 group-hover:border-[#8cff2e]/40 flex items-center justify-center mx-auto mb-4 transition-transform group-hover:scale-110 shadow-lg">
              <FileText className="w-8 h-8 text-[#8cff2e]" />
            </div>

            <h3 className="text-base font-bold text-white mb-1">
              {file ? file.name : 'Drop receipt PDF or Image here'}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              {file ? `${(file.size / 1024).toFixed(1)} KB selected` : 'or click to browse files from your computer'}
            </p>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px] text-slate-300 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-[#8cff2e]" />
              <span>EasyOCR Neural Line-Grouping Enabled</span>
            </div>
          </div>

          {file && (
            <button
              onClick={handleUpload}
              disabled={isProcessing}
              className="w-full py-3.5 rounded-xl bg-[#8cff2e] hover:bg-[#a6ff54] text-black font-extrabold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#8cff2e]/20 cursor-pointer disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-black" />
                  <span>Processing OCR & Extracting Data...</span>
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5 text-black" />
                  <span>Run OCR Extraction</span>
                </>
              )}
            </button>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Live Extracted Results */}
        <div className="lg:col-span-7 space-y-6">
          {extractedData ? (
            <div className="bg-[#0a0b0e] border border-white/10 rounded-2xl p-6 space-y-6 shadow-xl animate-fadeIn">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-[#8cff2e]" />
                  <h3 className="font-bold text-base text-white">Extracted Receipt Metadata</h3>
                </div>
                <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-[11px] font-mono text-slate-400">
                  {extractedData.Filename}
                </span>
              </div>

              {/* Parameter Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="bg-[#12141a] p-4 rounded-xl border border-white/5">
                  <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                    <Store className="w-3.5 h-3.5 text-[#8cff2e]" />
                    <span>Merchant</span>
                  </div>
                  <div className="font-bold text-sm text-white truncate">{extractedData.Merchant || 'N/A'}</div>
                </div>

                <div className="bg-[#12141a] p-4 rounded-xl border border-white/5">
                  <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                    <Calendar className="w-3.5 h-3.5 text-[#8cff2e]" />
                    <span>Date</span>
                  </div>
                  <div className="font-bold text-sm text-white">{extractedData.Date || 'N/A'}</div>
                </div>

                <div className="bg-[#12141a] p-4 rounded-xl border border-white/5">
                  <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                    <DollarSign className="w-3.5 h-3.5 text-[#8cff2e]" />
                    <span>Total Amount</span>
                  </div>
                  <div className="font-bold text-base text-[#8cff2e]">
                    {extractedData.Total_Amount ? `$${extractedData.Total_Amount}` : 'N/A'}
                  </div>
                </div>

                <div className="bg-[#12141a] p-4 rounded-xl border border-white/5">
                  <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                    <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                    <span>Subtotal</span>
                  </div>
                  <div className="font-bold text-sm text-white">
                    {extractedData.Subtotal ? `$${extractedData.Subtotal}` : 'N/A'}
                  </div>
                </div>

                <div className="bg-[#12141a] p-4 rounded-xl border border-white/5">
                  <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                    <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                    <span>Tax</span>
                  </div>
                  <div className="font-bold text-sm text-white">
                    {extractedData.Tax ? `$${extractedData.Tax}` : 'N/A'}
                  </div>
                </div>

                <div className="bg-[#12141a] p-4 rounded-xl border border-white/5">
                  <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                    <CreditCard className="w-3.5 h-3.5 text-[#8cff2e]" />
                    <span>Payment</span>
                  </div>
                  <div className="font-bold text-sm text-white truncate">{extractedData.Payment_Method || 'N/A'}</div>
                </div>
              </div>

              {/* Raw Extracted OCR Text */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Raw Extracted Text</h4>
                <div className="bg-[#050608] border border-white/5 rounded-xl p-4 font-mono text-xs text-emerald-400 max-h-48 overflow-y-auto whitespace-pre-wrap">
                  {rawText}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#0a0b0e] border border-white/10 rounded-2xl p-12 text-center text-slate-400 space-y-3">
              <FileText className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="font-bold text-white text-base">No Receipt Processed Yet</h3>
              <p className="text-xs max-w-sm mx-auto">
                Select a receipt PDF or image file on the left and click "Run OCR Extraction" to view parsed details here.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Batch History Table */}
      {batchHistory.length > 0 && (
        <div className="bg-[#0a0b0e] border border-white/10 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-white">Processed Receipts Summary</h3>
            <span className="text-xs text-slate-400">Total Extracted: {batchHistory.length}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#12141a] text-slate-400 border-b border-white/10 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Filename</th>
                  <th className="py-3 px-4">Merchant</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Subtotal</th>
                  <th className="py-3 px-4">Tax</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-200 font-medium">
                {batchHistory.map((item, idx) => (
                  <tr key={idx} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4 font-mono text-white">{item.Filename}</td>
                    <td className="py-3 px-4 font-bold">{item.Merchant}</td>
                    <td className="py-3 px-4 text-slate-400">{item.Date}</td>
                    <td className="py-3 px-4">${item.Subtotal || '0.00'}</td>
                    <td className="py-3 px-4">${item.Tax || '0.00'}</td>
                    <td className="py-3 px-4 font-bold text-[#8cff2e]">${item.Total_Amount || '0.00'}</td>
                    <td className="py-3 px-4 text-slate-400">{item.Payment_Method}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
