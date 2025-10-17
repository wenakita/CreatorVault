/**
 * Eagle Animation Component
 * Visual feedback for wrap/unwrap actions
 */

interface Props {
  mode: 'free' | 'cage';
  amount: string;
  onComplete?: () => void;
}

export default function EagleFreeAnimation({ mode, amount, onComplete }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="text-center">
        {/* Eagle Animation */}
        <div className="relative mb-8">
          {mode === 'free' ? (
            // Eagle flying away (wrap)
            <div className="animate-[float_2s_ease-in-out]">
              <img 
                src="https://tomato-abundant-urial-204.mypinata.cloud/ipfs/bafybeigzyatm2pgrkqbnskyvflnagtqli6rgh7wv7t2znaywkm2pixmkxy"
                alt="Eagle"
                className="w-32 h-32 object-contain mx-auto animate-pulse"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-eagle-gold/20 to-transparent blur-xl"></div>
            </div>
          ) : (
            // Eagle landing (unwrap)
            <div className="animate-[bounce_1s_ease-in-out_3]">
              <img 
                src="https://tomato-abundant-urial-204.mypinata.cloud/ipfs/bafybeigzyatm2pgrkqbnskyvflnagtqli6rgh7wv7t2znaywkm2pixmkxy"
                alt="Eagle"
                className="w-32 h-32 object-contain mx-auto"
              />
            </div>
          )}
        </div>

        {/* Message */}
        <div className="bg-eagle-gold/10 border border-eagle-gold/30 rounded-2xl p-8 backdrop-blur-md max-w-md mx-auto">
          <h2 className="text-3xl font-bold text-white mb-4">
            {mode === 'free' ? (
              <span className="bg-gradient-to-r from-eagle-gold-lightest to-eagle-gold bg-clip-text text-transparent">
                Eagle Set Free! 🦅
              </span>
            ) : (
              <span className="bg-gradient-to-r from-indigo to-purple bg-clip-text text-transparent">
                Eagle Secured 🏠
              </span>
            )}
          </h2>
          
          <p className="text-gray-300 mb-2">
            {mode === 'free' ? (
              <>Your {amount} vEAGLE is now free to fly across chains and trade on DEXes!</>
            ) : (
              <>Your {amount} EAGLE is now safely nested back in the vault, earning yield!</>
            )}
          </p>
          
          <p className="text-sm text-gray-400 mt-4">
            {mode === 'free' ? (
              <>EAGLE tokens are now active and tradable 🌐</>
            ) : (
              <>vEAGLE shares are compounding yield 📈</>
            )}
          </p>
        </div>

        {onComplete && (
          <button
            onClick={onComplete}
            className="mt-6 px-8 py-3 bg-eagle-gold hover:bg-eagle-gold-dark text-black font-semibold rounded-lg transition-all"
          >
            Continue
          </button>
        )}
      </div>
    </div>
  );
}

