"use client"

import * as React from "react"
import { Sparkles, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { deviceNamingAssistant } from "@/ai/flows/device-naming-assistant"
import { Badge } from "@/components/ui/badge"

interface NamingAssistantProps {
  deviceType: string;
  existingNames: string[];
  onSelect: (name: string) => void;
}

export function NamingAssistant({ deviceType, existingNames, onSelect }: NamingAssistantProps) {
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);

  const getSuggestions = async () => {
    if (!deviceType) return;
    setLoading(true);
    try {
      const result = await deviceNamingAssistant({
        deviceType,
        existingDeviceNames: existingNames
      });
      setSuggestions(result.suggestedNames);
    } catch (error) {
      console.error("Naming assistant failed", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">AI Suggestions</span>
        <Button 
          type="button" 
          variant="ghost" 
          size="sm" 
          onClick={getSuggestions}
          disabled={loading || !deviceType}
          className="h-7 px-2 text-xs text-primary hover:text-primary/80 hover:bg-primary/10"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
          {suggestions.length > 0 ? "Refresh" : "Suggest Names"}
        </Button>
      </div>
      
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
          {suggestions.map((name) => (
            <Badge 
              key={name} 
              variant="secondary" 
              className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors py-1.5 px-3 font-normal"
              onClick={() => onSelect(name)}
            >
              {name}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}