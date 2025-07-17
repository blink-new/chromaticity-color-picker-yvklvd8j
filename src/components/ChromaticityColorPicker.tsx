import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Copy, Info, Palette, Zap } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import {
  XYZColor,
  xyColor,
  RGBColor,
  LABColor,
  OKLCHColor,
  HSLColor,
  ColorSpace,
  XYZToxyY,
  xyYToXYZ,
  XYZToRGB,
  RGBToXYZ,
  RGBToHSL,
  XYZToLAB,
  LABToOKLCH,
  generateCSSColor,
  isInGamut,
  getColorTemperature,
  CHROMATICITY_BOUNDARY,
  SRGB_GAMUT,
  P3_GAMUT,
  REC2020_GAMUT,
  D65_WHITE_POINT,
  gammaCorrect
} from '@/utils/colorConversions';

interface ChromaticityColorPickerProps {
  onColorChange?: (color: {
    rgb: RGBColor;
    hsl: HSLColor;
    lab: LABColor;
    oklch: OKLCHColor;
    xy: xyColor;
    colorSpace: ColorSpace;
    cssColor: string;
  }) => void;
  initialColor?: RGBColor;
  initialColorSpace?: ColorSpace;
}

export default function ChromaticityColorPicker({
  onColorChange,
  initialColor = { r: 255, g: 100, b: 100 },
  initialColorSpace = 'sRGB'
}: ChromaticityColorPickerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedColorSpace, setSelectedColorSpace] = useState<ColorSpace>(initialColorSpace);
  const [currentColor, setCurrentColor] = useState<RGBColor>(initialColor);
  const [currentXY, setCurrentXY] = useState<xyColor>(() => {
    const xyz = RGBToXYZ(initialColor, selectedColorSpace);
    return XYZToxyY(xyz);
  });
  const [luminance, setLuminance] = useState<number>(0.5);
  const [showGamutOverlay, setShowGamutOverlay] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  // Canvas dimensions
  const CANVAS_WIDTH = 400;
  const CANVAS_HEIGHT = 400;
  const DIAGRAM_SIZE = 350;
  const DIAGRAM_OFFSET_X = 25;
  const DIAGRAM_OFFSET_Y = 25;

  // Draw chromaticity diagram
  const drawChromaticityDiagram = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw background gradient
    const gradient = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    gradient.addColorStop(0, '#f8fafc');
    gradient.addColorStop(1, '#e2e8f0');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw chromaticity boundary
    ctx.beginPath();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    
    CHROMATICITY_BOUNDARY.forEach((point, index) => {
      const x = DIAGRAM_OFFSET_X + point.x * DIAGRAM_SIZE;
      const y = DIAGRAM_OFFSET_Y + (1 - point.y) * DIAGRAM_SIZE;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Fill chromaticity area with subtle color
    ctx.fillStyle = 'rgba(59, 130, 246, 0.05)';
    ctx.fill();

    // Draw gamut triangles if overlay is enabled
    if (showGamutOverlay) {
      const gamuts = [
        { points: SRGB_GAMUT, color: '#ef4444', label: 'sRGB' },
        { points: P3_GAMUT, color: '#10b981', label: 'P3' },
        { points: REC2020_GAMUT, color: '#8b5cf6', label: 'Rec2020' }
      ];

      gamuts.forEach(({ points, color, label }) => {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        
        points.forEach((point, index) => {
          const x = DIAGRAM_OFFSET_X + point.x * DIAGRAM_SIZE;
          const y = DIAGRAM_OFFSET_Y + (1 - point.y) * DIAGRAM_SIZE;
          
          if (index === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });
        ctx.stroke();
        
        // Fill with transparent color
        ctx.fillStyle = color + '20';
        ctx.fill();
        
        ctx.setLineDash([]);
      });
    }

    // Draw grid lines
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    
    for (let i = 0; i <= 10; i++) {
      const x = DIAGRAM_OFFSET_X + (i / 10) * DIAGRAM_SIZE;
      const y = DIAGRAM_OFFSET_Y + (i / 10) * DIAGRAM_SIZE;
      
      ctx.beginPath();
      ctx.moveTo(x, DIAGRAM_OFFSET_Y);
      ctx.lineTo(x, DIAGRAM_OFFSET_Y + DIAGRAM_SIZE);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(DIAGRAM_OFFSET_X, y);
      ctx.lineTo(DIAGRAM_OFFSET_X + DIAGRAM_SIZE, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Draw axes labels
    ctx.fillStyle = '#475569';
    ctx.font = '12px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('x', DIAGRAM_OFFSET_X + DIAGRAM_SIZE / 2, CANVAS_HEIGHT - 5);
    
    ctx.save();
    ctx.translate(10, DIAGRAM_OFFSET_Y + DIAGRAM_SIZE / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('y', 0, 0);
    ctx.restore();

    // Draw current color point
    const currentX = DIAGRAM_OFFSET_X + currentXY.x * DIAGRAM_SIZE;
    const currentY = DIAGRAM_OFFSET_Y + (1 - currentXY.y) * DIAGRAM_SIZE;
    
    // Outer ring
    ctx.beginPath();
    ctx.arc(currentX, currentY, 12, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Inner color dot
    ctx.beginPath();
    ctx.arc(currentX, currentY, 8, 0, 2 * Math.PI);
    ctx.fillStyle = generateCSSColor(currentColor, selectedColorSpace);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw white point
    const whiteX = DIAGRAM_OFFSET_X + D65_WHITE_POINT.x * DIAGRAM_SIZE;
    const whiteY = DIAGRAM_OFFSET_Y + (1 - D65_WHITE_POINT.y) * DIAGRAM_SIZE;
    
    ctx.beginPath();
    ctx.arc(whiteX, whiteY, 4, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1;
    ctx.stroke();

  }, [currentColor, currentXY, selectedColorSpace, showGamutOverlay]);

  // Handle canvas click/drag
  const handleCanvasInteraction = useCallback((event: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Convert to chromaticity coordinates
    const chromaticityX = (x - DIAGRAM_OFFSET_X) / DIAGRAM_SIZE;
    const chromaticityY = 1 - (y - DIAGRAM_OFFSET_Y) / DIAGRAM_SIZE;

    // Clamp to valid range
    const clampedX = Math.max(0, Math.min(1, chromaticityX));
    const clampedY = Math.max(0, Math.min(1, chromaticityY));

    // Update current chromaticity
    const newXY: xyColor = { x: clampedX, y: clampedY, Y: luminance };
    setCurrentXY(newXY);

    // Convert to XYZ then to RGB
    const xyz = xyYToXYZ(newXY);
    const rgb = XYZToRGB(xyz, selectedColorSpace);
    
    // Apply gamma correction and clamp
    const correctedRgb: RGBColor = {
      r: Math.max(0, Math.min(255, gammaCorrect(rgb.r) * 255)),
      g: Math.max(0, Math.min(255, gammaCorrect(rgb.g) * 255)),
      b: Math.max(0, Math.min(255, gammaCorrect(rgb.b) * 255))
    };

    setCurrentColor(correctedRgb);
  }, [luminance, selectedColorSpace]);

  // Update color when dependencies change
  useEffect(() => {
    // Convert current color to other formats
    const xyz = RGBToXYZ(currentColor, selectedColorSpace);
    const hsl = RGBToHSL(currentColor);
    const lab = XYZToLAB(xyz);
    const oklch = LABToOKLCH(lab);
    const xy = XYZToxyY(xyz);
    const cssColor = generateCSSColor(currentColor, selectedColorSpace);

    onColorChange?.({
      rgb: currentColor,
      hsl,
      lab,
      oklch,
      xy,
      colorSpace: selectedColorSpace,
      cssColor
    });
  }, [currentColor, selectedColorSpace, onColorChange]);

  // Redraw canvas when needed
  useEffect(() => {
    drawChromaticityDiagram();
  }, [drawChromaticityDiagram]);

  // Copy color to clipboard
  const copyToClipboard = (text: string, format: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${format} copied to clipboard!`);
  };

  // Calculate color information
  const colorTemperature = getColorTemperature(currentXY.x, currentXY.y);
  const isColorInGamut = isInGamut(currentColor);
  const xyz = RGBToXYZ(currentColor, selectedColorSpace);
  const hsl = RGBToHSL(currentColor);
  const lab = XYZToLAB(xyz);
  const oklch = LABToOKLCH(lab);

  return (
    <TooltipProvider>
      <div className="w-full max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">Chromaticity Color Picker</h1>
          <p className="text-gray-600">Explore colors through the CIE 1931 chromaticity diagram</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chromaticity Diagram */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Palette className="w-5 h-5" />
                  CIE 1931 Chromaticity Diagram
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowGamutOverlay(!showGamutOverlay)}
                  >
                    {showGamutOverlay ? 'Hide' : 'Show'} Gamuts
                  </Button>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="w-4 h-4 text-gray-500" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Click or drag to select colors on the diagram</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center space-y-4">
                <canvas
                  ref={canvasRef}
                  width={CANVAS_WIDTH}
                  height={CANVAS_HEIGHT}
                  className="border border-gray-200 rounded-lg cursor-crosshair"
                  onMouseDown={() => setIsDragging(true)}
                  onMouseUp={() => setIsDragging(false)}
                  onMouseMove={(e) => isDragging && handleCanvasInteraction(e)}
                  onClick={handleCanvasInteraction}
                />
                
                {/* Luminance Control */}
                <div className="w-full max-w-md space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Luminance (Y): {luminance.toFixed(3)}
                  </label>
                  <Slider
                    value={[luminance]}
                    onValueChange={(value) => setLuminance(value[0])}
                    max={1}
                    min={0}
                    step={0.01}
                    className="w-full"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Color Information Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Color Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Color Preview */}
              <div className="space-y-2">
                <div
                  className="w-full h-20 rounded-lg border border-gray-200 shadow-sm"
                  style={{ backgroundColor: generateCSSColor(currentColor, selectedColorSpace) }}
                />
                <div className="flex items-center gap-2">
                  <Badge variant={isColorInGamut ? "default" : "destructive"}>
                    {isColorInGamut ? "In Gamut" : "Out of Gamut"}
                  </Badge>
                  <Badge variant="outline">
                    {Math.round(colorTemperature)}K
                  </Badge>
                </div>
              </div>

              {/* Color Space Selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Color Space</label>
                <Tabs value={selectedColorSpace} onValueChange={(value) => setSelectedColorSpace(value as ColorSpace)}>
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="sRGB">sRGB</TabsTrigger>
                    <TabsTrigger value="P3">P3</TabsTrigger>
                    <TabsTrigger value="Rec2020">Rec2020</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* Color Values */}
              <div className="space-y-3">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-gray-700">RGB Values</h4>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="text-center">
                      <div className="font-mono text-xs text-gray-600">R</div>
                      <div className="font-mono">{Math.round(currentColor.r)}</div>
                    </div>
                    <div className="text-center">
                      <div className="font-mono text-xs text-gray-600">G</div>
                      <div className="font-mono">{Math.round(currentColor.g)}</div>
                    </div>
                    <div className="text-center">
                      <div className="font-mono text-xs text-gray-600">B</div>
                      <div className="font-mono">{Math.round(currentColor.b)}</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-gray-700">HSL Values</h4>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="text-center">
                      <div className="font-mono text-xs text-gray-600">H</div>
                      <div className="font-mono">{Math.round(hsl.h)}°</div>
                    </div>
                    <div className="text-center">
                      <div className="font-mono text-xs text-gray-600">S</div>
                      <div className="font-mono">{Math.round(hsl.s)}%</div>
                    </div>
                    <div className="text-center">
                      <div className="font-mono text-xs text-gray-600">L</div>
                      <div className="font-mono">{Math.round(hsl.l)}%</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-gray-700">Chromaticity (xy)</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-center">
                      <div className="font-mono text-xs text-gray-600">x</div>
                      <div className="font-mono">{currentXY.x.toFixed(4)}</div>
                    </div>
                    <div className="text-center">
                      <div className="font-mono text-xs text-gray-600">y</div>
                      <div className="font-mono">{currentXY.y.toFixed(4)}</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Color Format Exports */}
        <Card>
          <CardHeader>
            <CardTitle>Export Color Formats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">RGB</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-gray-100 rounded text-sm font-mono">
                    rgb({Math.round(currentColor.r)}, {Math.round(currentColor.g)}, {Math.round(currentColor.b)})
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(
                      `rgb(${Math.round(currentColor.r)}, ${Math.round(currentColor.g)}, ${Math.round(currentColor.b)})`,
                      "RGB"
                    )}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">HSL</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-gray-100 rounded text-sm font-mono">
                    hsl({Math.round(hsl.h)}, {Math.round(hsl.s)}%, {Math.round(hsl.l)}%)
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(
                      `hsl(${Math.round(hsl.h)}, ${Math.round(hsl.s)}%, ${Math.round(hsl.l)}%)`,
                      "HSL"
                    )}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Modern CSS</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-gray-100 rounded text-sm font-mono">
                    {generateCSSColor(currentColor, selectedColorSpace)}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(
                      generateCSSColor(currentColor, selectedColorSpace),
                      "Modern CSS"
                    )}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">LAB</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-gray-100 rounded text-sm font-mono">
                    lab({lab.l.toFixed(1)}% {lab.a.toFixed(1)} {lab.b.toFixed(1)})
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(
                      `lab(${lab.l.toFixed(1)}% ${lab.a.toFixed(1)} ${lab.b.toFixed(1)})`,
                      "LAB"
                    )}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">OKLCH</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-gray-100 rounded text-sm font-mono">
                    oklch({oklch.l.toFixed(3)} {oklch.c.toFixed(3)} {oklch.h.toFixed(1)})
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(
                      `oklch(${oklch.l.toFixed(3)} ${oklch.c.toFixed(3)} ${oklch.h.toFixed(1)})`,
                      "OKLCH"
                    )}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">HEX</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-gray-100 rounded text-sm font-mono">
                    #{Math.round(currentColor.r).toString(16).padStart(2, '0')}
                    {Math.round(currentColor.g).toString(16).padStart(2, '0')}
                    {Math.round(currentColor.b).toString(16).padStart(2, '0')}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(
                      `#${Math.round(currentColor.r).toString(16).padStart(2, '0')}${Math.round(currentColor.g).toString(16).padStart(2, '0')}${Math.round(currentColor.b).toString(16).padStart(2, '0')}`,
                      "HEX"
                    )}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}