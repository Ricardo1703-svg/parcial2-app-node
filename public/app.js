const API = '/api/productos';

const form = document.getElementById('productForm');
const idInput = document.getElementById('productId');
const nombreInput = document.getElementById('nombre');
const precioInput = document.getElementById('precio');
const stockInput = document.getElementById('stock');
const saveBtn = document.getElementById('saveBtn');
const cancelBtn = document.getElementById('cancelBtn');
const formTitle = document.getElementById('formTitle');
const formTag = document.getElementById('formTag');
const table = document.getElementById('productsTable');
const message = document.getElementById('message');

let products = [];

function showMessage(text, type = 'success') {
  message.textContent = text;
  message.className = `message ${type}`;
}

function clearMessage() {
  message.textContent = '';
  message.className = 'message hidden';
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || data.mensaje || `Error HTTP ${response.status}`);
  }

  return data;
}

function money(value) {
  return new Intl.NumberFormat('es-SV', {
    style: 'currency',
    currency: 'USD'
  }).format(Number(value));
}

function dateFormat(value) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString('es-SV');
}

function addCell(row, value, className = '') {
  const cell = document.createElement('td');
  cell.textContent = value;
  if (className) cell.className = className;
  row.appendChild(cell);
  return cell;
}

function renderProducts() {
  table.replaceChildren();

  document.getElementById('resultCount').textContent =
    `${products.length} ${products.length === 1 ? 'producto' : 'productos'}`;

  document.getElementById('totalProducts').textContent = products.length;

  document.getElementById('totalStock').textContent =
    products.reduce((sum, product) => sum + Number(product.stock), 0)
      .toLocaleString('es-SV');

  const totalValue = products.reduce(
    (sum, product) => sum + Number(product.precio) * Number(product.stock), 0
  );

  document.getElementById('inventoryValue').textContent = money(totalValue);

  if (products.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 6;
    cell.className = 'empty';
    cell.textContent = 'No hay productos registrados. Puedes agregar el primero usando el formulario.';
    row.appendChild(cell);
    table.appendChild(row);
    return;
  }

  for (const product of products) {
    const row = document.createElement('tr');

    addCell(row, String(product.id));
    addCell(row, product.nombre, 'product-name');
    addCell(row, money(product.precio));
    addCell(row, Number(product.stock).toLocaleString('es-SV'));
    addCell(row, dateFormat(product.creado_en));

    const actionsCell = document.createElement('td');
    const actions = document.createElement('div');
    actions.className = 'actions';

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'button edit';
    editButton.textContent = 'Editar';
    editButton.addEventListener('click', () => editProduct(product.id));

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'button danger';
    deleteButton.textContent = 'Eliminar';
    deleteButton.addEventListener('click', () => deleteProduct(product));

    actions.append(editButton, deleteButton);
    actionsCell.appendChild(actions);
    row.appendChild(actionsCell);
    table.appendChild(row);
  }
}

async function loadProducts() {
  const refreshBtn = document.getElementById('refreshBtn');
  refreshBtn.disabled = true;
  clearMessage();

  try {
    products = await request(API);
    renderProducts();
  } catch (error) {
    showMessage(`No se pudieron cargar los productos: ${error.message}`, 'error');
    table.replaceChildren();

    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 6;
    cell.className = 'empty';
    cell.textContent = 'No fue posible consultar la API. Intenta actualizar.';
    row.appendChild(cell);
    table.appendChild(row);
  } finally {
    refreshBtn.disabled = false;
  }
}

function resetForm() {
  form.reset();
  idInput.value = '';
  formTitle.textContent = 'Registrar producto';
  formTag.textContent = 'NUEVO';
  saveBtn.textContent = 'Guardar producto';
  cancelBtn.classList.add('hidden');
}

function editProduct(id) {
  const product = products.find(item => String(item.id) === String(id));
  if (!product) return;

  idInput.value = product.id;
  nombreInput.value = product.nombre;
  precioInput.value = Number(product.precio).toFixed(2);
  stockInput.value = product.stock;

  formTitle.textContent = `Editar producto #${product.id}`;
  formTag.textContent = 'EDICIÓN';
  saveBtn.textContent = 'Guardar cambios';
  cancelBtn.classList.remove('hidden');

  clearMessage();
  document.getElementById('formPanel').scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });
  nombreInput.focus({ preventScroll: true });
}

async function deleteProduct(product) {
  const confirmed = window.confirm(
    `¿Deseas eliminar "${product.nombre}" (ID ${product.id})? Esta acción no se puede deshacer.`
  );

  if (!confirmed) return;

  clearMessage();

  try {
    await request(`${API}/${encodeURIComponent(product.id)}`, {
      method: 'DELETE'
    });

    if (String(idInput.value) === String(product.id)) resetForm();

    showMessage('Producto eliminado correctamente.');
    await loadProducts();
  } catch (error) {
    showMessage(`No se pudo eliminar el producto: ${error.message}`, 'error');
  }
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  clearMessage();

  const nombre = nombreInput.value.trim();
  const precio = Number(precioInput.value);
  const stock = Number(stockInput.value);

  if (!nombre || nombre.length > 120) {
    showMessage('El nombre es obligatorio y no debe superar 120 caracteres.', 'error');
    return;
  }

  if (precioInput.value.trim() === '' ||
      !Number.isFinite(precio) || precio < 0 || precio > 99999999.99) {
    showMessage('Ingresa un precio válido mayor o igual a cero.', 'error');
    return;
  }

  if (stockInput.value.trim() === '' ||
      !Number.isSafeInteger(stock) || stock < 0) {
    showMessage('Las existencias deben ser un entero no negativo.', 'error');
    return;
  }

  const id = idInput.value;
  const editing = id !== '';

  saveBtn.disabled = true;

  try {
    await request(editing ? `${API}/${encodeURIComponent(id)}` : API, {
      method: editing ? 'PUT' : 'POST',
      body: JSON.stringify({ nombre, precio, stock })
    });

    resetForm();
    showMessage(editing
      ? 'Producto actualizado correctamente.'
      : 'Producto registrado correctamente.');

    await loadProducts();
  } catch (error) {
    showMessage(`No se pudo guardar el producto: ${error.message}`, 'error');
  } finally {
    saveBtn.disabled = false;
  }
});

cancelBtn.addEventListener('click', () => {
  resetForm();
  clearMessage();
});

document.getElementById('refreshBtn').addEventListener('click', loadProducts);

loadProducts();
