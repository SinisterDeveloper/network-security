"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface MacInputProps extends React.ComponentProps<"input"> {
  onValidityChange?: (isValid: boolean) => void;
}

export function MacInput({ className, onValidityChange, value, onChange, ...props }: MacInputProps) {
  const [error, setError] = React.useState<string | null>(null);

  const validateMac = (val: string) => {
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    const isValid = macRegex.test(val);
    if (val && !isValid) {
      setError("ERR_INVALID_MAC");
      onValidityChange?.(false);
    } else {
      setError(null);
      onValidityChange?.(isValid);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.toUpperCase().replace(/[^0-9A-F]/g, '');
    
    let formatted = "";
    for (let i = 0; i < val.length && i < 12; i++) {
      if (i > 0 && i % 2 === 0) formatted += ":";
      formatted += val[i];
    }
    
    const syntheticEvent = {
      ...e,
      target: {
        ...e.target,
        value: formatted
      }
    } as React.ChangeEvent<HTMLInputElement>;

    onChange?.(syntheticEvent);
    validateMac(formatted);
  };

  return (
    <div className="space-y-1">
      <Input
        {...props}
        value={value}
        onChange={handleInputChange}
        className={cn(
          "font-mono tracking-wider uppercase rounded-none border-border focus-visible:ring-0",
          error && "border-foreground text-foreground",
          className
        )}
        placeholder="00:00:00:00:00:00"
        maxLength={17}
      />
      {error && <p className="text-[8px] font-bold uppercase">{error}</p>}
    </div>
  )
}
