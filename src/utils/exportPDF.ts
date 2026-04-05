import { PlacedPlant, PlotSettings } from '@/types/garden';
import { getPlantById } from '@/data/plants';

export async function exportGardenPDF(settings: PlotSettings, plants: PlacedPlant[], planName: string) {
  // Dynamic import to keep bundle lean
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;

  // Title
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(`🌱 ${planName}`, margin, margin + 5);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${settings.widthM} x ${settings.heightM} ${settings.unit} | ${plants.length} plants | ${new Date().toLocaleDateString()}`, margin, margin + 12);

  // Draw grid
  const gridX = margin;
  const gridY = margin + 18;
  const cellSizeCm = (settings as any).cellSizeCm || 25;
  const cols = Math.round(settings.widthM * (settings.unit === 'meters' ? (100 / cellSizeCm) : (30.48 / cellSizeCm)));
  const rows = Math.round(settings.heightM * (settings.unit === 'meters' ? (100 / cellSizeCm) : (30.48 / cellSizeCm)));
  const cellW = Math.min((pageW - 2 * margin) / cols, (pageH - gridY - margin - 40) / rows);
  const gridW = cols * cellW;
  const gridH = rows * cellW;

  // Grid lines
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  for (let i = 0; i <= cols; i++) doc.line(gridX + i * cellW, gridY, gridX + i * cellW, gridY + gridH);
  for (let i = 0; i <= rows; i++) doc.line(gridX, gridY + i * cellW, gridX + gridW, gridY + i * cellW);

  // Border
  doc.setDrawColor(100, 100, 100);
  doc.setLineWidth(0.5);
  doc.rect(gridX, gridY, gridW, gridH);

  // Place plants (as text labels with initials)
  doc.setFontSize(Math.min(cellW * 0.6, 8));
  doc.setFont('helvetica', 'bold');
  plants.forEach(placed => {
    const plant = getPlantById(placed.plantId);
    if (!plant) return;
    const x = gridX + placed.x * cellW + cellW / 2;
    const y = gridY + placed.y * cellW + cellW / 2;
    // Draw colored circle
    doc.setFillColor(120, 180, 100);
    doc.circle(x, y, cellW * 0.35, 'F');
    // Draw initials
    doc.setTextColor(255, 255, 255);
    const initials = plant.name.substring(0, 2);
    doc.text(initials, x, y + 1, { align: 'center' });
  });

  // Plant legend below grid
  doc.setTextColor(0, 0, 0);
  const legendY = gridY + gridH + 8;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Plant List', margin, legendY);

  const uniquePlants = [...new Set(plants.map(p => p.plantId))];
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  let lx = margin;
  let ly = legendY + 5;
  uniquePlants.forEach(id => {
    const plant = getPlantById(id);
    if (!plant) return;
    const count = plants.filter(p => p.plantId === id).length;
    const text = `${plant.name} (x${count}) - Spacing: ${plant.spacingCm}cm${plant.harvest ? `, Harvest: ${plant.harvest}` : ''}`;
    if (lx + doc.getTextWidth(text) > pageW - margin) {
      lx = margin;
      ly += 4;
    }
    doc.text(text, lx, ly);
    lx += doc.getTextWidth(text) + 8;
  });

  doc.save(`${planName.replace(/\s+/g, '-').toLowerCase()}-garden-plan.pdf`);
}
