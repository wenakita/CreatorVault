import { badge, type BadgeProps } from "@tailus/themer"

export interface BadgeVariantsProps extends React.HTMLAttributes<HTMLDivElement>, BadgeProps {}

export const Badge: React.FC<BadgeVariantsProps> = ({
    className,
    children,
    intent = "primary", 
    size = "md",
    variant = "soft",
    ...props
  }) => {
    return(
        <span className={badge[variant]({intent, size, className})} {...props}>
            {children}
        </span>
    )
}
  
Badge.displayName = "Badge";
export default Badge;