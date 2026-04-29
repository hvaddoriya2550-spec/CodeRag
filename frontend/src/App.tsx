import { Routes, Route } from 'react-router-dom'
import Layout from '@/components/layout/Layout'
import HomePage from '@/pages/HomePage'
import ChatPage from '@/pages/ChatPage'

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/chat/:repoId" element={<ChatPage />} />
      </Route>
    </Routes>
  )
}

export default App
