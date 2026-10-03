import React, { useState } from 'react';
import { X, Copy, Check, Share2 } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareUrl: string;
  theme?: 'lavender' | 'dark';
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  shareUrl,
  theme = 'lavender',
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const isLavender = theme === 'lavender';
  const fullUrl = `${window.location.origin}${shareUrl}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div
        className={`rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl relative border ${
          isLavender
            ? 'bg-white/95 border-purple-200 text-slate-900 shadow-purple-500/20'
            : 'bg-[#0F1626] border-slate-800 text-white'
        }`}
      >
        <button
          onClick={onClose}
          className={`absolute top-3.5 right-3.5 sm:top-4 sm:right-4 p-1 rounded-lg ${isLavender ? 'text-slate-400 hover:text-slate-700' : 'text-slate-400 hover:text-white'}`}
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 sm:gap-3 mb-4">
          <div className={`p-2 sm:p-2.5 rounded-xl border shrink-0 ${
            isLavender
              ? 'bg-purple-100 text-purple-700 border-purple-200'
              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
          }`}>
            <Share2 className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
          </div>
          <div>
            <h3 className={`text-sm sm:text-base font-bold ${isLavender ? 'text-slate-900' : 'text-white'}`}>Share Analysis Permalink</h3>
            <p className={`text-[11px] sm:text-xs ${isLavender ? 'text-slate-500' : 'text-slate-400'}`}>Anyone with this link can view this query report</p>
          </div>
        </div>

        <div className={`flex items-center gap-2 border rounded-xl p-2 mb-5 ${
          isLavender
            ? 'bg-slate-50 border-purple-200 text-slate-800'
            : 'bg-[#080C14] border-slate-800 text-slate-300'
        }`}>
          <input
            type="text"
            readOnly
            value={fullUrl}
            className={`w-full bg-transparent text-xs font-mono px-2 focus:outline-none ${isLavender ? 'text-purple-950 font-semibold' : 'text-slate-300'}`}
          />
          <button
            onClick={handleCopy}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
              isLavender
                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy
              </>
            )}
          </button>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition ${
              isLavender
                ? 'text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200'
                : 'text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700'
            }`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
