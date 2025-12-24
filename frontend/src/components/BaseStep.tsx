import { motion } from 'framer-motion'
import { ReactNode } from 'react'

/**
 * BaseStep - Numbered step component inspired by Base Account
 * From: https://www.base.org/build/base-account
 * 
 * "01, 02, 03" style numbered sections with clean cards
 */

interface BaseStepProps {
  number: number
  title: string
  description: string
  icon?: ReactNode
  isActive?: boolean
  delay?: number
}

export function BaseStep({
  number,
  title,
  description,
  icon,
  isActive = false,
  delay = 0,
}: BaseStepProps) {
  const paddedNumber = number.toString().padStart(2, '0')

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.32,
        delay: delay,
        ease: [0.4, 0, 0.2, 1], // Base ease curve
      }}
      className={`relative flex items-start gap-6 p-6 rounded-2xl border transition-all duration-200 ${
        isActive
          ? 'bg-brand-500/5 border-brand-500/30'
          : 'bg-surface-900/50 border-surface-800 hover:border-surface-700'
      }`}
      style={{
        transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Large number background */}
      <div className="absolute top-4 right-4 font-mono text-6xl font-black text-brand-500/[0.08] select-none pointer-events-none">
        {paddedNumber}
      </div>

      {/* Number indicator */}
      <div
        className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center font-mono text-sm font-bold transition-colors duration-200 ${
          isActive
            ? 'bg-brand-500 text-white'
            : 'bg-surface-800 text-surface-400'
        }`}
        style={{
          transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {paddedNumber}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-2">
          {icon && (
            <span className={isActive ? 'text-brand-400' : 'text-surface-400'}>
              {icon}
            </span>
          )}
          <h3 className="font-semibold text-lg text-white">{title}</h3>
        </div>
        <p className="text-surface-400 text-sm leading-relaxed">{description}</p>
      </div>
    </motion.div>
  )
}

/**
 * BaseStepList - Container for multiple steps with connecting line
 */
interface BaseStepListProps {
  children: ReactNode
  className?: string
}

export function BaseStepList({ children, className = '' }: BaseStepListProps) {
  return (
    <div className={`relative space-y-4 ${className}`}>
      {/* Connecting line */}
      <div className="absolute left-[2.875rem] top-16 bottom-16 w-px bg-gradient-to-b from-brand-500/40 via-surface-700 to-transparent" />
      {children}
    </div>
  )
}

/**
 * Horizontal step indicator (for progress bars)
 */
interface StepIndicatorProps {
  steps: { id: string; label: string }[]
  currentStep: number
  className?: string
}

export function StepIndicator({ steps, currentStep, className = '' }: StepIndicatorProps) {
  return (
    <div className={`flex items-center justify-between ${className}`}>
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center">
          <div className="flex flex-col items-center">
            <motion.div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-mono text-sm font-bold transition-all duration-200 ${
                index < currentStep
                  ? 'bg-green-500 text-white'
                  : index === currentStep
                  ? 'bg-brand-500 text-white ring-4 ring-brand-500/20'
                  : 'bg-surface-800 text-surface-500'
              }`}
              initial={false}
              animate={{
                scale: index === currentStep ? 1.05 : 1,
              }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            >
              {index < currentStep ? '✓' : (index + 1).toString().padStart(2, '0')}
            </motion.div>
            <span
              className={`mt-2 text-xs font-medium transition-colors duration-200 ${
                index <= currentStep ? 'text-white' : 'text-surface-500'
              }`}
            >
              {step.label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div
              className={`w-16 sm:w-24 h-0.5 mx-3 transition-colors duration-200 ${
                index < currentStep ? 'bg-green-500' : 'bg-surface-800'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  )
}


import { ReactNode } from 'react'

/**
 * BaseStep - Numbered step component inspired by Base Account
 * From: https://www.base.org/build/base-account
 * 
 * "01, 02, 03" style numbered sections with clean cards
 */

interface BaseStepProps {
  number: number
  title: string
  description: string
  icon?: ReactNode
  isActive?: boolean
  delay?: number
}

export function BaseStep({
  number,
  title,
  description,
  icon,
  isActive = false,
  delay = 0,
}: BaseStepProps) {
  const paddedNumber = number.toString().padStart(2, '0')

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.32,
        delay: delay,
        ease: [0.4, 0, 0.2, 1], // Base ease curve
      }}
      className={`relative flex items-start gap-6 p-6 rounded-2xl border transition-all duration-200 ${
        isActive
          ? 'bg-brand-500/5 border-brand-500/30'
          : 'bg-surface-900/50 border-surface-800 hover:border-surface-700'
      }`}
      style={{
        transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Large number background */}
      <div className="absolute top-4 right-4 font-mono text-6xl font-black text-brand-500/[0.08] select-none pointer-events-none">
        {paddedNumber}
      </div>

      {/* Number indicator */}
      <div
        className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center font-mono text-sm font-bold transition-colors duration-200 ${
          isActive
            ? 'bg-brand-500 text-white'
            : 'bg-surface-800 text-surface-400'
        }`}
        style={{
          transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {paddedNumber}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-2">
          {icon && (
            <span className={isActive ? 'text-brand-400' : 'text-surface-400'}>
              {icon}
            </span>
          )}
          <h3 className="font-semibold text-lg text-white">{title}</h3>
        </div>
        <p className="text-surface-400 text-sm leading-relaxed">{description}</p>
      </div>
    </motion.div>
  )
}

/**
 * BaseStepList - Container for multiple steps with connecting line
 */
interface BaseStepListProps {
  children: ReactNode
  className?: string
}

export function BaseStepList({ children, className = '' }: BaseStepListProps) {
  return (
    <div className={`relative space-y-4 ${className}`}>
      {/* Connecting line */}
      <div className="absolute left-[2.875rem] top-16 bottom-16 w-px bg-gradient-to-b from-brand-500/40 via-surface-700 to-transparent" />
      {children}
    </div>
  )
}

/**
 * Horizontal step indicator (for progress bars)
 */
interface StepIndicatorProps {
  steps: { id: string; label: string }[]
  currentStep: number
  className?: string
}

export function StepIndicator({ steps, currentStep, className = '' }: StepIndicatorProps) {
  return (
    <div className={`flex items-center justify-between ${className}`}>
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center">
          <div className="flex flex-col items-center">
            <motion.div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-mono text-sm font-bold transition-all duration-200 ${
                index < currentStep
                  ? 'bg-green-500 text-white'
                  : index === currentStep
                  ? 'bg-brand-500 text-white ring-4 ring-brand-500/20'
                  : 'bg-surface-800 text-surface-500'
              }`}
              initial={false}
              animate={{
                scale: index === currentStep ? 1.05 : 1,
              }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            >
              {index < currentStep ? '✓' : (index + 1).toString().padStart(2, '0')}
            </motion.div>
            <span
              className={`mt-2 text-xs font-medium transition-colors duration-200 ${
                index <= currentStep ? 'text-white' : 'text-surface-500'
              }`}
            >
              {step.label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div
              className={`w-16 sm:w-24 h-0.5 mx-3 transition-colors duration-200 ${
                index < currentStep ? 'bg-green-500' : 'bg-surface-800'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  )
}

