import React, { useState } from "react";

interface Item {
  id: number;
  label: string;
}

function first<T>(items: T[]): T | undefined {
  return items[0];
}

const TypedFixture: React.FC = () => {
  const [items] = useState<Item[]>([{ id: 1, label: "typed works" }]);
  const item = first(items) as Item;
  return <p data-testid="typed">{item.label}</p>;
};

export default TypedFixture;
