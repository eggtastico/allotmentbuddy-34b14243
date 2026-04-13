export function GuidesView() {
  const guides = [
    {
      id: 'spacing',
      title: '📏 Plant Spacing',
      description: 'Learn why spacing matters and how much room plants need',
      tips: [
        'Proper spacing ensures good airflow and reduces disease',
        'Plants need space for roots to access water and nutrients',
        'Check the spacing info in each plant\'s details',
      ],
    },
    {
      id: 'watering',
      title: '💧 Watering Guide',
      description: 'Master the art of keeping plants hydrated',
      tips: [
        'Water early morning or late evening to reduce evaporation',
        'Most plants prefer consistent moisture over soggy soil',
        'Check soil moisture before watering - stick your finger 2cm deep',
        'Heavy clay soils hold water longer than sandy soils',
      ],
    },
    {
      id: 'companions',
      title: '🌿 Companion Planting',
      description: 'Grow better plants by choosing the right neighbours',
      tips: [
        'Some plants repel pests that harm others',
        'Companions can improve soil and water retention',
        'Check the companion plants in each plant\'s details',
        'Rotate crop families yearly to maintain soil health',
      ],
    },
    {
      id: 'frost',
      title: '❄️ Frost Dates',
      description: 'Understand when to plant tender vs hardy crops',
      tips: [
        'Last spring frost date: latest safe day for tender plants',
        'First fall frost date: when to harvest before freezing',
        'Set your location for accurate frost dates',
        'Hardy plants can survive light frosts',
      ],
    },
    {
      id: 'sunlight',
      title: '☀️ Light Requirements',
      description: 'Get the right amount of sun for each plant',
      tips: [
        'Full sun: 6+ hours of direct sunlight daily',
        'Partial shade: 3-6 hours of sunlight or dappled light',
        'Full shade: less than 3 hours of direct sunlight',
        'Afternoon shade helps prevent summer scorch in hot climates',
      ],
    },
    {
      id: 'soil',
      title: '🌍 Soil Health',
      description: 'Build rich, living soil for thriving plants',
      tips: [
        'Add organic matter (compost, manure) annually',
        'Avoid planting the same family in the same spot yearly',
        'Mulch around plants to retain moisture and prevent weeds',
        'Healthy soil supports beneficial bacteria and microbes',
      ],
    },
  ];

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-2xl font-semibold text-foreground sticky top-0 bg-background py-2 z-10">
        📚 Growing Guides
      </h2>

      {guides.map((guide) => (
        <div
          key={guide.id}
          className="border border-border rounded-lg p-4 hover:shadow-md transition-shadow"
        >
          <h3 className="text-lg font-semibold text-foreground mb-1">
            {guide.title}
          </h3>
          <p className="text-sm text-muted-foreground mb-3">
            {guide.description}
          </p>
          <ul className="space-y-2">
            {guide.tips.map((tip, idx) => (
              <li key={idx} className="text-xs text-muted-foreground flex gap-2">
                <span className="text-primary flex-shrink-0">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
