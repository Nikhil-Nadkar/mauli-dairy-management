import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { BranchProvider } from "../context/BranchContext.jsx";
import { LanguageProvider } from "../i18n/LanguageContext.jsx";

/** Render a page with everything it needs around it. Tests mock AuthContext's useAuth themselves. */
export function renderPage(page, { route = "/" } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <LanguageProvider>
        <BranchProvider>{page}</BranchProvider>
      </LanguageProvider>
    </MemoryRouter>
  );
}
