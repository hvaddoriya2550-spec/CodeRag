import { Outlet } from 'react-router-dom'

export default function Layout() {
  return (
    <div className="h-screen overflow-hidden bg-[#0a0a0f] text-white">
      <Outlet />
    </div>
  )
}
