const items = [
  { id: 1, name: "Truffle Mushroom Soup", category: "starters", price: 8.99, description: "Warm mushroom soup with truffle oil and crisp herbs." },
  { id: 2, name: "Grilled Salmon Fillet", category: "mains", price: 19.95, description: "Pan-seared salmon with lemon beurre blanc and seasonal greens." },
  { id: 3, name: "Herb Roasted Chicken", category: "mains", price: 16.5, description: "Juicy roasted chicken with rosemary, garlic, and roasted vegetables." },
  { id: 4, name: "Chocolate Lava Cake", category: "desserts", price: 7.25, description: "Warm chocolate cake with a molten center and vanilla gelato." },
  { id: 5, name: "Citrus Berry Salad", category: "starters", price: 9.5, description: "Fresh greens with berries, citrus, toasted nuts, and honey vinaigrette." },
  { id: 6, name: "Sparkling Citrus Spritz", category: "drinks", price: 5.5, description: "Refreshing soda spritz with orange, lime, and mint." },
  { id: 7, name: "Classic Cheeseburger", category: "mains", price: 14.0, description: "House-ground beef patty, cheddar, lettuce, tomato, and special sauce." },
  { id: 8, name: "Matcha Green Tea", category: "drinks", price: 4.75, description: "Ceremonial matcha with almond milk and a touch of honey." }
];

const itemGrid = document.getElementById("itemGrid");
const categoryFilter = document.getElementById("categoryFilter");

function formatPrice(value) {
  return `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function renderItems(filter) {
  itemGrid.innerHTML = "";
  const filteredItems = filter === "all" ? items : items.filter(item => item.category === filter);

  if (filteredItems.length === 0) {
    itemGrid.innerHTML = `<div class="item-card"><div class="item-content"><h3>No items found</h3><p>Try selecting a different category to see available menu items.</p></div></div>`;
    return;
  }

  filteredItems.forEach(item => {
    const card = document.createElement("article");
    card.className = "item-card";
    card.innerHTML = `
      <div class="item-content">
        <h3>${item.name}</h3>
        <p>${item.description}</p>
        <div class="item-meta">
          <span>${formatPrice(item.price)}</span>
          <span class="tag">${item.category}</span>
        </div>
      </div>
    `;
    itemGrid.appendChild(card);
  });
}

categoryFilter.addEventListener("change", event => {
  renderItems(event.target.value);
});

renderItems("all");
