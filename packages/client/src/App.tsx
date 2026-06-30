import { ThemeProvider } from './hooks/useTheme'
import { Header } from './components/Header'
import { Dashboard } from './components/Dashboard'

export default function App() {
  return (
    <ThemeProvider>
      <div className="min-h-dvh flex flex-col">
        <Header />
        <main className="flex-1">
          <Dashboard />
        </main>
      </div>
    </ThemeProvider>
  )
}
