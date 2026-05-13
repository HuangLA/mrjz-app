import { serviceNames } from "@mrjz/shared";

const root = document.querySelector("#root");

if (root) {
  root.textContent = `${serviceNames.admin} scaffold`;
}
