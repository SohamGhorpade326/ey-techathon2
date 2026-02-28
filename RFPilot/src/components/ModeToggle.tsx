import React from "react";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/providers/ThemeProvider";

export function ModeToggle() {
  const { theme, toggle } = useTheme();

  // Show Sun when currently dark (toggle to light), Moon when currently light
  const Icon = theme === "dark" ? Sun : Moon;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      title="Toggle theme"
      aria-label="Toggle theme"
    >
      <Icon className="h-5 w-5" />
    </Button>
  );
}

export default ModeToggle;
