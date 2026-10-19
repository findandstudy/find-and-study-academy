import {useEffect, useState} from 'react';
import {normalizeInvitationCode, readTrainingDestinations, startCampaignPreview, type CampaignPreview, type TrainingDestination} from '@/lib/homepage-data';

type Coverage = {status: 'loading' | 'unavailable'; destinations: TrainingDestination[]} | {status: 'ready'; destinations: TrainingDestination[]};

export function useTrainingCoverage(): Coverage {
  const [coverage, setCoverage] = useState<Coverage>({status: 'loading', destinations: []});
  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    async function load() {
      try {
        const response = await fetch('/api/public/countries', {signal: controller.signal, credentials: 'omit'});
        const destinations = response.ok ? readTrainingDestinations(await response.json()) : null;
        if (current) setCoverage(destinations ? {status: 'ready', destinations} : {status: 'unavailable', destinations: []});
      } catch {
        if (current) setCoverage({status: 'unavailable', destinations: []});
      }
    }
    void load();
    return () => { current = false; controller.abort(); };
  }, []);
  return coverage;
}

export function useCampaignPreview(input: string): CampaignPreview {
  const promoCode = normalizeInvitationCode(input);
  const [preview, setPreview] = useState<CampaignPreview>({status: 'idle', promoCode: ''});
  useEffect(() => startCampaignPreview(promoCode, setPreview), [promoCode]);
  // Hide an earlier offer during the render immediately after an input change.
  return preview.promoCode === promoCode ? preview : {status: 'idle', promoCode};
}
