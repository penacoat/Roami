import React from 'react';
import { Redirect } from 'expo-router';
import { isFrontendPreview } from '../config/preview';
import { DesignReview } from '../dev/DesignReview';

export default function DesignReviewRoute() {
  return __DEV__ && isFrontendPreview ? <DesignReview /> : <Redirect href="/" />;
}
