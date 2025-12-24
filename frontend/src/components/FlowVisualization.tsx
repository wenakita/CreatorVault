import { motion } from 'framer-motion'

interface FlowNode {
  label: string
  value?: string
  highlight?: boolean
}

interface FlowVisualizationProps {
  nodes: FlowNode[]
  branches?: FlowNode[][] // For split flows
  title?: string
  className?: string
}

export function FlowVisualization({ 
  nodes, 
  branches,
  title,
  className = '' 
}: FlowVisualizationProps) {
  return (
    <div className={`flex flex-col items-center py-10 gap-5 ${className}`}>
      {title && (
        <div className="text-sm font-mono uppercase tracking-widest text-magma-mint/70 mb-4">
          {title}
        </div>
      )}

      {/* Main flow nodes */}
      {nodes.map((node, index) => (
        <div key={index} className="flex flex-col items-center gap-5 w-full">
          <motion.div
            className={`
              bg-basalt-light px-6 py-4 border text-center font-mono text-sm
              ${node.highlight 
                ? 'border-blue-500 text-blue-400 shadow-lg shadow-blue-500/20' 
                : 'border-basalt-light'
              }
            `}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: index * 0.15 }}
          >
            <div>{node.label}</div>
            {node.value && (
              <div className="text-xs opacity-60 mt-1">{node.value}</div>
            )}
          </motion.div>

          {/* Flow line */}
          {index < nodes.length - 1 && !branches && (
            <motion.div 
              className="w-px h-10 bg-gradient-to-b from-magma-mint to-basalt-light relative overflow-hidden"
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.3, delay: index * 0.15 + 0.15 }}
            >
              {/* Animated pulse */}
              <motion.div
                className="absolute inset-0 w-full bg-magma-mint"
                initial={{ y: '-100%' }}
                animate={{ y: '100%' }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'linear',
                  delay: index * 0.3
                }}
              />
            </motion.div>
          )}

          {/* Branches */}
          {branches && index === nodes.length - 1 && (
            <div className="w-full relative">
              {/* Horizontal connector line */}
              <div className="absolute top-0 left-[15%] right-[15%] h-px bg-basalt-light" />
              
              <div className="flex justify-around w-full pt-5">
                {branches.map((branch, branchIndex) => (
                  <div key={branchIndex} className="flex flex-col items-center gap-5">
                    {/* Vertical line */}
                    <motion.div 
                      className="w-px h-10 bg-gradient-to-b from-basalt-light to-magma-mint"
                      initial={{ scaleY: 0 }}
                      animate={{ scaleY: 1 }}
                      transition={{ duration: 0.3, delay: 0.5 + branchIndex * 0.1 }}
                    />
                    
                    {/* Branch nodes */}
                    {branch.map((branchNode, nodeIndex) => (
                      <motion.div
                        key={nodeIndex}
                        className={`
                          px-4 py-3 border text-center font-mono text-xs
                          ${branchNode.highlight 
                            ? 'border-copper-bright bg-copper-bright/10' 
                            : 'border-basalt-light bg-basalt'
                          }
                        `}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ 
                          duration: 0.3, 
                          delay: 0.7 + branchIndex * 0.1 + nodeIndex * 0.1 
                        }}
                      >
                        <div className="whitespace-nowrap">{branchNode.label}</div>
                        {branchNode.value && (
                          <div className="text-[10px] opacity-60 mt-1">
                            {branchNode.value}
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

