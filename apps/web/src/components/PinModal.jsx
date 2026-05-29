import { useEffect, useRef, useState } from 'react';

/**
 * PinModal — prompts the user for their 6-digit transfer PIN.
 *
 * Props:
 *   open      {boolean}        — whether the modal is visible
 *   purpose   {string}         — human-readable label for the operation
 *   onConfirm {(pin: string) => void} — called with the PIN when the user submits
 *   onCancel  {() => void}     — called when the user dismisses
 */
export function PinModal({ open, purpose = 'transfer', onConfirm, onCancel }) {
  const [pin, setPin] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setPin('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  function handleSubmit(e) {
    e.preventDefault();
    if (pin.length === 6) onConfirm(pin);
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') onCancel();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pin-modal-title"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-white rounded-2xl shadow-xl ring-1 ring-pine-100 w-full max-w-sm mx-4 p-6">
        <h2 id="pin-modal-title" className="text-lg font-bold text-pine-900 mb-1">
          Authorize {purpose}
        </h2>
        <p className="text-sm text-pine-700 mb-5">
          Enter the 6-digit single-use PIN issued by your banker to authorize this transaction.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="pin-input">
              Transfer PIN
            </label>
            <input
              id="pin-input"
              ref={inputRef}
              className="input text-center tracking-[0.4em] text-xl font-mono"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              minLength={6}
              placeholder="••••••"
              required
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              autoComplete="one-time-code"
            />
          </div>
          <div className="flex gap-3">
            <button type="submit" className="btn-primary flex-1" disabled={pin.length !== 6}>
              Authorize
            </button>
            <button type="button" className="btn-secondary flex-1" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </form>
        <p className="text-xs text-pine-700 mt-4">
          Don&apos;t have a PIN? Contact support to request one.
        </p>
      </div>
    </div>
  );
}
