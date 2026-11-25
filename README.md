# TEG Simulation — Industrial Waste Heat Recovery Simulation

Interactive 3D engineering simulation of a **Thermoelectric Generator (TEG)** industrial waste-heat recovery apparatus featuring coupled thermal-electrical physics, parametric CAD geometry, FEA heat-map shaders, CFD airflow streamlines, and Seebeck carrier transport visualization.

## Features
- **3D Laboratory Setup (`3D Setup`)**: Parametric TEG stack (radiant heating block, copper spreaders, Bi₂Te₃ ceramic module with live `e⁻`/`h⁺` transport, heat sink fins, open-shroud axial cooling fan with helical CFD airflow, thermal insulation wrap, and live OLED electrical output monitor).
- **Coupled Engineering Solver**: First-Law series-parallel thermal circuit linking fin arrays (`Fin Design`), forced/natural/mixed convection (`Cooling System`), thermal insulation (`Insulation`), and TEG load curve (`TEG Performance`).
- **Interactive Analysis**: Parametric charts (`Graphs`), multi-design optimization (`Optimization`), and printable engineering report (`Report`).

## Running Locally
```bash
npm install
npm run dev
```
Open `http://localhost:5174/`.

## Deploying to GitHub Pages (Public Shareable Link)
1. Upload this repository to GitHub (excluding `node_modules/` and `dist/`).
2. Open your repository **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Wait ~1–2 minutes for the `Deploy TEG Simulation to GitHub Pages` workflow to complete.
5. Share your live public URL: `https://<your-username>.github.io/<repo-name>/`.
