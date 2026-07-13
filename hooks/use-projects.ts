import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export function useProjects() {
  const supabase = createClient()

  const { data: projects = [], isLoading, error } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .is('archived_at', null)
        .order('created_at', { ascending: true })
      if (error) throw error
      // Inbox（クイックキャプチャの受け皿）は常に先頭に表示する（名前ベースのピン留め）
      return (data ?? []).sort(
        (a: any, b: any) => (a.name === 'Inbox' ? 0 : 1) - (b.name === 'Inbox' ? 0 : 1)
      )
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })

  return { projects, isLoading, error }
}
