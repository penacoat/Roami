import { router } from 'expo-router';
import { RecommendationsScreen } from '../../components/recommendations/recommendationsScreen';

export default function PostcardsRoute() {
  return (
    <RecommendationsScreen
      onOpenPlace={(placeId, recommendationId) =>
        router.navigate({ pathname: '/', params: { placeId, recommendationId } })
      }
    />
  );
}
