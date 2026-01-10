import { motion } from 'framer-motion'
import { Radio, ExternalLink } from 'lucide-react'

interface ZoraLiveStreamProps {
  streamUrl: string
  title?: string
  isLive?: boolean
}

export function ZoraLiveStream({ streamUrl, title = 'Live Stream', isLive = true }: ZoraLiveStreamProps) {
  return (
    <div className="bg-black border border-white/10 rounded-xl overflow-hidden">
      {/* Live stream container */}
      <div className="relative bg-black aspect-video">
        <iframe
          src={streamUrl}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={title}
        />
        
        {/* Live badge */}
        {isLive && (
          <div className="absolute top-4 left-4">
            <motion.div
              className="flex items-center gap-2 bg-red-500/90 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-xs font-medium shadow-lg"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                className="w-2 h-2 rounded-full bg-white"
                animate={{ 
                  opacity: [1, 0.3, 1],
                  scale: [1, 1.2, 1]
                }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <Radio className="w-3 h-3" />
              <span>LIVE</span>
            </motion.div>
          </div>
        )}

        {/* View on Zora button */}
        <div className="absolute bottom-4 right-4">
          <motion.a
            href={streamUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-black/80 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-xs hover:bg-black/90 transition-colors border border-white/20"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <span>View on Zora</span>
            <ExternalLink className="w-3 h-3" />
          </motion.a>
        </div>
      </div>

      {/* Stream info */}
      <div className="p-4 bg-black/40 border-t border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-white font-medium text-sm">{title}</h4>
            {isLive && (
              <p className="text-zinc-600 text-xs mt-1">
                <span className="text-green-400">●</span> Live now
              </p>
            )}
          </div>
          {isLive && (
            <div className="text-right">
              <div className="text-cyan-400 font-mono text-sm font-bold">
                {Math.floor(Math.random() * 500 + 100)}
              </div>
              <div className="text-zinc-600 text-[10px] uppercase tracking-wider">
                Viewers
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}



