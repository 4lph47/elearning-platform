// userAId/userBId da Conversation ficam sempre em ordem canónica (menor id
// primeiro) — sem isto, A a falar com B e B a falar com A criavam duas
// conversas diferentes em vez de partilharem a mesma.
export function canonicalPair(userId1: string, userId2: string): [string, string] {
  return userId1 < userId2 ? [userId1, userId2] : [userId2, userId1];
}
