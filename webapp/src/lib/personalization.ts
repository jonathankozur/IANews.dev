import { supabase } from '@/lib/supabase';

export type PolicyType = 'left' | 'center' | 'right';

export interface UserScores {
  left: number;
  center: number;
  right: number;
}

export async function getUserLeaning(sessionId: string | undefined): Promise<{ leaning: PolicyType, scores: UserScores }> {
  const defaultScores = { left: 0, center: 0, right: 0 };
  if (!sessionId) return { leaning: 'center', scores: defaultScores };

  // Fetch article interactions
  const { data: interactions, error } = await supabase
    .from('user_interactions')
    .select(`
interaction_type,
    time_spent_seconds,
    news_variants(
        policy_type
    )
        `)
    .eq('session_id', sessionId);

  // Fetch comment interactions
  const { data: commentInteractions, error: commentError } = await supabase
    .from('comment_interactions')
    .select(`
interaction_type,
    comments(
        author_leaning
    )
        `)
    .eq('session_id', sessionId);

  if (error || !interactions) {
    console.error('Error fetching interactions for personalization:', error);
    return { leaning: 'center', scores: defaultScores };
  }

  let scores = { left: 0, center: 0, right: 0 };

  // Score from Articles
  interactions.forEach((interaction: any) => {
    const policy = interaction.news_variants?.policy_type as PolicyType;
    if (!policy) return;

    if (interaction.interaction_type === 'read') {
      scores[policy] += 1;
    } else if (interaction.interaction_type === 'like') {
      scores[policy] += 3;
    } else if (interaction.interaction_type === 'dislike') {
      scores[policy] -= 3;
    }
  });

  // Score from Comments
  if (commentInteractions) {
    commentInteractions.forEach((cInt: any) => {
      const policy = cInt.comments?.author_leaning as PolicyType;
      if (!policy || policy === 'center') return; // Center doesn't heavily weight you in mvp

      if (cInt.interaction_type === 'like') {
        scores[policy] += 2;
      }
      // Assuming dislike doesn't necessarily pull you towards the opposite, just adds 0.
    });
  }

  // Calculate highest score
  let maxScore = -Infinity;
  let dominantPolicy: PolicyType = 'center'; // Default tiebreaker

  for (const [policy, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      dominantPolicy = policy as PolicyType;
    }
  }

  // If new user with no scores or zero scores across the board, default to center
  if (maxScore === 0 && scores.left === 0 && scores.center === 0 && scores.right === 0) {
    return { leaning: 'center', scores: defaultScores };
  }

  return { leaning: dominantPolicy, scores };
}

export async function getUserCategoryPreferences(sessionId: string | undefined): Promise<Record<string, number>> {
  if (!sessionId) return {};

  // 1. Fetch user interactions
  const { data: interactions, error } = await supabase
    .from('user_interactions')
    .select(`
            interaction_type,
            variant:news_variants (
                event:news_events (
                    category
                )
            )
        `)
    .eq('session_id', sessionId);

  if (error || !interactions) {
    console.error('Error fetching categories for personalization', error);
    return {};
  }

  // 2. Aggregate category scores
  const categoryScores: Record<string, number> = {};

  interactions.forEach((interaction: any) => {
    // Safe navigation as some nested joins might return arrays or single objects based on supabase configs, but usually single for variants->events
    const eventData = Array.isArray(interaction.variant) ? interaction.variant[0]?.event : interaction.variant?.event;

    let category = 'General';
    if (eventData) {
      category = Array.isArray(eventData) ? (eventData[0]?.category || 'General') : (eventData?.category || 'General');
    }

    let scoreDelta = 0;
    switch (interaction.interaction_type) {
      case 'like': scoreDelta = 5; break;
      case 'dislike': scoreDelta = -2; break; // Aún mostramos cosas que no les gustan, pero menos
      case 'read': scoreDelta = 1; break;
    }

    categoryScores[category] = (categoryScores[category] || 0) + scoreDelta;
  });

  return categoryScores;
}

export async function getCategoryLeaningMatrix(sessionId: string | undefined): Promise<Record<string, PolicyType>> {
  if (!sessionId) return {};

  const { data: interactions, error } = await supabase
    .from('user_interactions')
    .select(`
            interaction_type,
            variant:news_variants (
                policy_type,
                event:news_events (
                    category
                )
            )
        `)
    .eq('session_id', sessionId);

  if (error || !interactions) return {};

  // matrix[category][policy_type] = score
  const matrix: Record<string, Record<PolicyType, number>> = {};

  interactions.forEach((interaction: any) => {
    const variantData = Array.isArray(interaction.variant) ? interaction.variant[0] : interaction.variant;
    if (!variantData) return;

    const policy = variantData.policy_type as PolicyType;
    if (!policy) return;

    const eventData = Array.isArray(variantData.event) ? variantData.event[0] : variantData.event;
    const category = eventData?.category || 'General';

    if (!matrix[category]) {
      matrix[category] = { left: 0, center: 0, right: 0 };
    }

    let scoreDelta = 0;
    switch (interaction.interaction_type) {
      case 'like': scoreDelta = 3; break;
      case 'dislike': scoreDelta = -3; break;
      case 'read': scoreDelta = 1; break;
    }

    matrix[category][policy] += scoreDelta;
  });

  const result: Record<string, PolicyType> = {};
  for (const [category, scores] of Object.entries(matrix)) {
    let maxScore = -Infinity;
    let dominant: PolicyType = 'center';
    for (const [p, s] of Object.entries(scores)) {
      if (s > maxScore) {
        maxScore = s;
        dominant = p as PolicyType;
      }
    }
    // Solo asignamos si el maxScore es > 0, si no, lo dejamos neutral
    if (maxScore > 0) {
      result[category] = dominant;
    } else {
      result[category] = 'center';
    }
  }

  return result;
}

