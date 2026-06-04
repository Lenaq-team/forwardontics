import * as React from "react"

import { cn } from "@/lib/utils/helpers"

interface InputProps extends React.ComponentProps<"input"> {
  icon?: React.ReactNode
  iconPosition?: "left" | "right"
  iconClassName?: string
  suffix?: React.ReactNode
  prefixText?: React.ReactNode
}

function Input({ className, type, icon, iconPosition = "left", suffix, prefixText, iconClassName, ...props }: InputProps) {
  return (
    <div className="flex items-center justify-between w-full rounded-md border border-neutral-200 px-2 bg-white">
      {icon && iconPosition === "left" && (
        <div className="flex items-center pointer-events-none">
          {icon}
        </div>
      )}
      {prefixText && (
        <div className="flex items-center pointer-events-none">
          {prefixText}
        </div>
      )}
      <input
        type={type}
        data-slot="input"
        className={cn(
          "file:text-neutral-950 placeholder:text-neutral-300 selection:bg-neutral-900 selection:text-neutral-50 dark:bg-neutral-200/30  flex h-9 w-full min-w-0  bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:file:text-neutral-50 dark:placeholder:text-neutral-400 dark:selection:bg-neutral-50 dark:selection:text-neutral-900 dark:dark:bg-neutral-800/30 dark:border-neutral-800",

          "aria-invalid:ring-red-500/20 dark:aria-invalid:ring-red-500/40 aria-invalid:border-red-500  dark:dark:aria-invalid:ring-red-900/40 dark:aria-invalid:border-red-900",
          icon && iconPosition === "left" && "pl-2",
          icon && iconPosition === "right" && "pr-2",
          className
        )}
        {...props}
      />
      {icon && iconPosition === "right" && (
        <div className={cn("flex items-center pointer-events-none", iconClassName)}>
          {icon}
        </div>
      )}
      {suffix && (
        <div className="flex items-center pointer-events-none">
          {suffix}
        </div>
      )}
    </div>
  )
}

export { Input }
