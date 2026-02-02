import { Outlet, Link, useLocation } from 'react-router-dom'

const menu = [
  { label: '대시보드', path: '/' },
  { label: '주문', path: '/orders' },
  { label: '재고', path: '/inventory' },
  { label: '상품', path: '/products' },
  { label: '카테고리', path: '/categories' },
  { label: '설정', path: '/settings' },
]

export function AppShell() {
  const { pathname } = useLocation()

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'Inter, Arial, sans-serif' }}>
      <aside style={{ width: 260, borderRight: '1px solid #111827' }}>
        <div style={{ height: 72, background: '#f3f4f6', display: 'flex', alignItems: 'center', padding: '0 16px' }}>
          <strong>RocketGrowth Console</strong>
        </div>
        <nav style={{ padding: 16, display: 'grid', gap: 12 }}>
          {menu.map((m) => {
            const active = pathname === m.path || (m.path !== '/' && pathname.startsWith(m.path))
            return (
              <Link
                key={m.path}
                to={m.path}
                style={{
                  textDecoration: 'none',
                  color: '#111827',
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid #111827',
                  background: active ? '#fafafa' : 'transparent',
                }}
              >
                {m.label}
              </Link>
            )
          })}
        </nav>
      </aside>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <header style={{ height: 72, borderBottom: '1px solid #111827', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px' }}>
          <div />
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ border: '1px solid #111827', background: '#fafafa', borderRadius: 10, padding: '8px 10px' }}>
              Vendor: 12345
            </div>
            <div style={{ border: '1px solid #111827', background: '#fafafa', borderRadius: 10, padding: '8px 10px' }}>
              운영
            </div>
            <div style={{ border: '1px solid #111827', background: '#fafafa', borderRadius: 10, padding: '8px 10px' }}>
              최근 호출: OK / 0 실패
            </div>
          </div>
        </header>
        <div style={{ padding: 16, overflow: 'auto' }}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
