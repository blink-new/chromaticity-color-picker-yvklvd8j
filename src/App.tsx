import { useState } from 'react';
import { Toaster } from 'sonner';
import ChromaticityColorPicker from './components/ChromaticityColorPicker';
import { RGBColor, HSLColor, LABColor, OKLCHColor, xyColor, ColorSpace } from './utils/colorConversions';

function App() {
  const [selectedColor, setSelectedColor] = useState<{
    rgb: RGBColor;
    hsl: HSLColor;
    lab: LABColor;
    oklch: OKLCHColor;
    xy: xyColor;
    colorSpace: ColorSpace;
    cssColor: string;
  } | null>(null);

  const handleColorChange = (color: {
    rgb: RGBColor;
    hsl: HSLColor;
    lab: LABColor;
    oklch: OKLCHColor;
    xy: xyColor;
    colorSpace: ColorSpace;
    cssColor: string;
  }) => {
    setSelectedColor(color);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto py-8">
        <ChromaticityColorPicker
          onColorChange={handleColorChange}
          initialColor={{ r: 255, g: 100, b: 100 }}
          initialColorSpace="sRGB"
        />
      </div>
      <Toaster position="top-right" />
    </div>
  );
}

export default App;