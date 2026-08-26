type PsychoProfileCardProps = {
  variant: 'strength' | 'leak';
  title: string;
  items: string[];
};

function PsychoProfileCard({ variant, title, items }: PsychoProfileCardProps) {
  return (
    <div className={`psycho-card ${variant}`}>
      <div className="psycho-card-header">
        <span className="psycho-card-dot" aria-hidden="true" />
        <h4>{title}</h4>
      </div>
      <ul className="psycho-card-list">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export default PsychoProfileCard;
