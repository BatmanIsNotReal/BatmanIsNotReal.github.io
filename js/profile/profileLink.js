// The address of a player's character page (player.html sits next to index.html)
export function profileUrl(name) {
	return "player.html?name=" + encodeURIComponent(String(name));
}

// Turns an element into a link to that player's page, opened in a new tab
export function makeProfileLink(element, name) {
	element.href = profileUrl(name);
	element.target = "_blank";
	element.rel = "noopener";
	element.title = "Open " + name + "'s character page";
	return element;
}
