# UI Components: Portal de Gestión de Flota Municipal

Short reference for the styles already in this project. Use these patterns before creating anything new.

## 1. Current stack
- React + JSX
- CSS in `src/App.css`
- Parcel
- Supabase
- Lucide React icons

## 2. Colors used in the app
| Name | CSS variable | Value |
|---|---|---|
| Navy | `--navy` | `#082b46` |
| Blue | `--blue` | `#1d5fa8` |
| Lime accent | `--accent` | `#d9f52a` |
| Green | `--green` | `#1f8a4c` |
| Red | `--red` | `#c0392b` |
| Gray | `--gray` | `#667085` |
| Border | `--border` | `#e1e6ec` |
| Page bg | `--bg` | `#f4f6f8` |
| White | `--white` | `#ffffff` |
| Text | `--text` | `#1b2635` |

## 3. Spacing and radius
- Use multiples of 4px.
- Common sizes: `8px`, `12px`, `16px`, `20px`, `24px`.
- Radii used: `6px`, `10px`, `12px`.
- Card shadow: `0 1px 3px rgba(16, 24, 40, 0.08)`.

## 4. Existing reusable classes
Use these before creating new styles:

- Layout: `.app-layout`, `.sidebar`, `.main-content`, `.page-header`, `.page-content`
- Search/profile: `.search-wrap`, `.user-profile`, `.avatar`
- Dashboard cards: `.stats`, `.stat`, `.stat.green`, `.stat.red`, `.stat.navy`
- Content cards: `.card`, `.overview-grid`, `.actions-grid`, `.action-card`
- Buttons: `.btn`, `.btn-ghost`, `.btn-link`
- Feedback: `.msg`, `.msg.error`, `.msg.ok`

## 5. Actual page patterns
### Top bar
```jsx
<header className="page-header">
  <div className="search-wrap">
    <input type="search" placeholder="Buscar..." aria-label="Buscar" />
  </div>

  <div className="user-profile">
    <span className="avatar">AB</span>
    <div>
      <strong>Usuario</strong>
      <p>Administrador</p>
    </div>
    <button className="btn-ghost" type="button">Salir</button>
  </div>
</header>
```

### Stat card
```jsx
<article className="stat navy">
  <span className="stat-icon"><CarFront size={30} /></span>
  <div>
    <p className="label">Total de vehículos</p>
    <p className="value">42</p>
  </div>
</article>
```

### Quick action card
```jsx
<button className="action-card" type="button">
  <span className="action-icon"><ClipboardList size={28} /></span>
  Registrar uso diario
</button>
```

## 6. Design direction
The current UI is:
- dark navy sidebar
- light gray background
- white cards
- lime accent for active/selected items
- green/red for status
- simple rounded cards, no heavy shadows

## 7. Rule
Before creating a new component, check if one of the classes above already matches it. Reuse the project’s existing styling instead of inventing a new version.
