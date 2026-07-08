-- agents テーブルには SELECT ポリシーしかなく（0001 の agents_select）、
-- Web UI からの INSERT が RLS で常に拒否されていた。
-- シングルユーザー運用のため authenticated で十分。
-- UPDATE/DELETE ポリシーは意図的に付けない（スコープ変更・削除は SQL Editor 経由のまま）。
DROP POLICY IF EXISTS "agents_insert" ON agents;
CREATE POLICY "agents_insert" ON agents
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
