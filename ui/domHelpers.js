export function appendChildren(node, children) {
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child == null || child === false) continue;
    if (Array.isArray(child)) {
      appendChildren(node, child);
      continue;
    }
    if (child && typeof child === "object" && typeof child.nodeType === "number") {
      node.appendChild(child);
      continue;
    }
    node.appendChild(document.createTextNode(String(child)));
  }
  return node;
}

export function createElement(tagName, options = {}, children = []) {
  const { attrs = {}, className = "", dataset = {}, text = null, checked = false } = options;
  const node = document.createElement(tagName);
  if (className) node.className = className;
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null) continue;
    node.setAttribute(key, String(value));
  }
  for (const [key, value] of Object.entries(dataset)) {
    if (value == null) continue;
    node.dataset[key] = String(value);
  }
  if (checked) node.checked = true;
  if (text != null) {
    node.textContent = String(text);
  } else {
    appendChildren(node, children);
  }
  return node;
}

export function replaceChildren(node, children = []) {
  node.replaceChildren();
  appendChildren(node, children);
  return node;
}

export function createOption(option = {}) {
  const {
    value = "",
    label = "",
    attrs = {},
    dataset = {},
    selected = false,
    disabled = false,
  } = option;
  const node = createElement("option", {
    attrs: { value, ...attrs },
    dataset,
    text: label,
  });
  if (selected) node.selected = true;
  if (disabled) node.disabled = true;
  return node;
}

export function replaceSelectOptions(node, options = []) {
  return replaceChildren(
    node,
    (Array.isArray(options) ? options : []).map((option) => createOption(option)),
  );
}
