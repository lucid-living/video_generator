/**
 * Component for inputting and editing the style guide.
 */

import { useState } from "react";

interface StyleGuideInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function StyleGuideInput({
  value,
  onChange,
  disabled = false,
}: StyleGuideInputProps) {
  return (
    <div className="style-guide-input">
      <label htmlFor="style-guide" className="block text-sm font-medium mb-2">
        Style Guide
      </label>
      <textarea
        id="style-guide"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Enter visual style guide (e.g., 'Neon-lit cyberpunk aesthetic, dark urban environments, neon lighting, futuristic technology')"
        className="w-full p-3 border border-gray-300 rounded-md min-h-[100px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
      />
      <p className="mt-1 text-sm text-gray-500">
        This style guide will be injected into all video prompts for consistency.
      </p>
    </div>
  );
}




