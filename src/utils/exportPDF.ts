import { PlacedPlant, PlotSettings } from '@/types/garden';
import { getPlantById, rotationGroupLabels, rotationGroupColors } from '@/data/plants';

export async function exportGardenPDF(settings: PlotSettings, plants: PlacedPlant[], planName: string) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;

  // ── Page 1: Garden Plan Grid ──
  // Title bar
  doc.setFillColor(46, 139, 87); // primary green
  doc.rect(0, 0, pageW, 18, 'F');
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(`Allotment Buddy - ${planName}`, margin, 12);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`${settings.widthM}×${settings.heightM} ${settings.unit} | ${plants.length} plants | ${new Date().toLocaleDateString('en-GB')}`, pageW - margin, 12, { align: 'right' });

  // Draw grid
  const gridX = margin;
  const gridY = 24;
  const cellSizeCm = settings.cellSizeCm || 25;
  const cols = Math.round(settings.widthM * (settings.unit === 'meters' ? (100 / cellSizeCm) : (30.48 / cellSizeCm)));
  const rows = Math.round(settings.heightM * (settings.unit === 'meters' ? (100 / cellSizeCm) : (30.48 / cellSizeCm)));
  const maxCellW = (pageW - 2 * margin) / cols;
  const maxCellH = (pageH - gridY - margin - 50) / rows;
  const cellW = Math.min(maxCellW, maxCellH);
  const gridW = cols * cellW;
  const gridH = rows * cellW;

  // Grid background
  doc.setFillColor(250, 250, 245);
  doc.rect(gridX, gridY, gridW, gridH, 'F');

  // Grid lines
  doc.setDrawColor(220, 220, 210);
  doc.setLineWidth(0.15);
  for (let i = 0; i <= cols; i++) doc.line(gridX + i * cellW, gridY, gridX + i * cellW, gridY + gridH);
  for (let i = 0; i <= rows; i++) doc.line(gridX, gridY + i * cellW, gridX + gridW, gridY + i * cellW);

  // Border
  doc.setDrawColor(46, 139, 87);
  doc.setLineWidth(0.6);
  doc.rect(gridX, gridY, gridW, gridH);

  // Axis labels
  doc.setFontSize(6);
  doc.setTextColor(140, 140, 140);
  doc.setFont('helvetica', 'normal');
  const labelInterval = settings.unit === 'meters' ? Math.round(100 / cellSizeCm) : Math.round(30.48 / cellSizeCm);
  for (let i = 0; i <= cols; i++) {
    if (i % labelInterval === 0) {
      const label = settings.unit === 'meters' ? `${Math.round(i * cellSizeCm / 100)}m` : `${Math.round(i * cellSizeCm / 30.48)}ft`;
      doc.text(label, gridX + i * cellW, gridY - 1.5, { align: 'center' });
    }
  }

  // Category colors for legend
  const catColors: Record<string, [number, number, number]> = {
    vegetable: [76, 175, 80],
    fruit: [233, 30, 99],
    herb: [0, 150, 136],
    flower: [255, 193, 7],
  };

  // Place plants
  const uniquePlants = [...new Set(plants.map(p => p.plantId))];
  const plantDataMap = new Map(uniquePlants.map(id => [id, getPlantById(id)!]).filter(([, d]) => d));

  doc.setFontSize(Math.min(cellW * 0.55, 7));
  doc.setFont('helvetica', 'bold');
  plants.forEach(placed => {
    const plant = plantDataMap.get(placed.plantId);
    if (!plant) return;
    const x = gridX + placed.x * cellW;
    const y = gridY + placed.y * cellW;
    const cc = catColors[plant.category] || [120, 120, 120];
    doc.setFillColor(cc[0], cc[1], cc[2]);
    doc.roundedRect(x + 0.5, y + 0.5, cellW - 1, cellW - 1, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    const initials = plant.name.substring(0, 2).toUpperCase();
    doc.text(initials, x + cellW / 2, y + cellW / 2 + 1, { align: 'center' });
  });

  // ── Legend section below grid ──
  doc.setTextColor(46, 139, 87);
  const legendY = gridY + gridH + 6;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Plant Legend', margin, legendY);

  // Category legend
  doc.setFontSize(7);
  let cx = margin;
  Object.entries(catColors).forEach(([cat, color]) => {
    doc.setFillColor(color[0], color[1], color[2]);
    doc.circle(cx + 1.5, legendY + 5, 1.5, 'F');
    doc.setTextColor(60, 60, 60);
    doc.text(cat.charAt(0).toUpperCase() + cat.slice(1), cx + 4.5, legendY + 6);
    cx += 25;
  });

  // Plant list with quantities and spacing
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50, 50, 50);
  let ly = legendY + 12;
  let lx = margin;
  const colWidth = (pageW - 2 * margin) / 3;

  uniquePlants.forEach((id, i) => {
    const plant = plantDataMap.get(id);
    if (!plant) return;
    const count = plants.filter(p => p.plantId === id).length;
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = margin + col * colWidth;
    const y = ly + row * 5;
    if (y > pageH - margin) return;

    const cc = catColors[plant.category] || [120, 120, 120];
    doc.setFillColor(cc[0], cc[1], cc[2]);
    doc.circle(x + 1, y - 0.8, 0.8, 'F');
    doc.setTextColor(50, 50, 50);
    doc.text(`${plant.emoji} ${plant.name} x${count}  |  ${plant.spacingCm}cm spacing${plant.harvest ? `  |  Harvest: ${plant.harvest}` : ''}`, x + 3, y);
  });

  // ── Page 2: Shopping List & Spacing Notes ──
  doc.addPage();

  // Header
  doc.setFillColor(46, 139, 87);
  doc.rect(0, 0, pageW, 18, 'F');
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(`Shopping List & Notes - ${planName}`, margin, 12);

  let py = 26;

  // Shopping list
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(46, 139, 87);
  doc.text('Seeds / Plants Needed', margin, py);
  py += 6;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');

  // Table header
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, py, pageW - 2 * margin, 6, 'F');
  doc.setTextColor(80, 80, 80);
  doc.setFont('helvetica', 'bold');
  doc.text('Plant', margin + 2, py + 4);
  doc.text('Qty', margin + 65, py + 4);
  doc.text('Spacing', margin + 80, py + 4);
  doc.text('Sow', margin + 100, py + 4);
  doc.text('Harvest', margin + 125, py + 4);
  doc.text('Notes', margin + 150, py + 4);
  py += 7;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50, 50, 50);

  uniquePlants.forEach(id => {
    const plant = plantDataMap.get(id);
    if (!plant || py > pageH - 15) return;
    const count = plants.filter(p => p.plantId === id).length;

    if (Math.floor((py - 26) / 5) % 2 === 0) {
      doc.setFillColor(248, 248, 248);
      doc.rect(margin, py - 3, pageW - 2 * margin, 5, 'F');
    }

    doc.setTextColor(50, 50, 50);
    doc.text(`${plant.emoji} ${plant.name}${plant.variety ? ` (${plant.variety})` : ''}`, margin + 2, py);
    doc.text(`${count}`, margin + 65, py);
    doc.text(`${plant.spacingCm}cm`, margin + 80, py);
    doc.text(plant.sowIndoors || plant.sowOutdoors || '—', margin + 100, py);
    doc.text(plant.harvest || '—', margin + 125, py);
    doc.text(plant.difficulty || '', margin + 150, py);
    py += 5;
  });

  py += 8;

  // Rotation groups summary
  if (py < pageH - 40) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(46, 139, 87);
    doc.text('Crop Rotation Groups', margin, py);
    py += 6;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');

    const groupCounts: Record<string, number> = {};
    plants.forEach(p => {
      const d = plantDataMap.get(p.plantId);
      if (d) groupCounts[d.rotationGroup] = (groupCounts[d.rotationGroup] || 0) + 1;
    });

    Object.entries(groupCounts).forEach(([group, count]) => {
      if (py > pageH - 10) return;
      const label = rotationGroupLabels[group] || group;
      doc.setTextColor(50, 50, 50);
      doc.text(`• ${label}: ${count} plants`, margin + 4, py);
      py += 4.5;
    });
  }

  py += 8;

  // Companion planting summary
  if (py < pageH - 30) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(46, 139, 87);
    doc.text('Companion Planting Notes', margin, py);
    py += 6;

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');

    for (const id of uniquePlants) {
      const plant = plantDataMap.get(id);
      if (!plant || py > pageH - 10) continue;
      if (plant.companions.length === 0 && plant.enemies.length === 0) continue;

      doc.setTextColor(50, 50, 50);
      doc.setFont('helvetica', 'bold');
      doc.text(`${plant.name}:`, margin + 4, py);
      doc.setFont('helvetica', 'normal');

      let nx = margin + 4 + doc.getTextWidth(`${plant.name}: `) + 1;
      if (plant.companions.length > 0) {
        doc.setTextColor(34, 139, 34);
        const goodText = `Good with: ${plant.companions.map(c => getPlantById(c)?.name || c).join(', ')}`;
        doc.text(goodText, nx, py);
        py += 3.5;
        nx = margin + 4;
      }
      if (plant.enemies.length > 0) {
        doc.setTextColor(200, 50, 50);
        const badText = `Avoid: ${plant.enemies.map(e => getPlantById(e)?.name || e).join(', ')}`;
        doc.text(badText, nx, py);
        py += 3.5;
      }
      py += 1.5;
    }
  }

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text('Generated by Allotment Buddy', margin, pageH - 5);
  doc.text(new Date().toLocaleDateString('en-GB'), pageW - margin, pageH - 5, { align: 'right' });

  // Page 1 footer too
  doc.setPage(1);
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text('Generated by Allotment Buddy', margin, pageH - 5);
  doc.text('Page 1 of 2', pageW - margin, pageH - 5, { align: 'right' });

  doc.save(`${planName.replace(/\s+/g, '-').toLowerCase()}-garden-plan.pdf`);
}
