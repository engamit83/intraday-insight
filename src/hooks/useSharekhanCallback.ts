import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const PLACEHOLDER_USER_ID = '00000000-0000-0000-0000-000000000000';

export const useSharekhanCallback = () => {
  const hasProcessed = useRef(false);

  useEffect(() => {
    const handleOAuthCallback = async () => {
      // Prevent double processing
      if (hasProcessed.current) return;

      const urlParams = new URLSearchParams(window.location.search);
      const requestToken = urlParams.get('request_token');

      if (!requestToken) return;

      hasProcessed.current = true;

      try {
        console.log('Sharekhan OAuth: Exchanging request_token...');

        const { data, error } = await supabase.functions.invoke('sharekhan-auth', {
          body: {
            action: 'exchange-token',
            request_token: requestToken,
            user_id: PLACEHOLDER_USER_ID
          }
        });

        if (error) {
          console.error('Sharekhan OAuth exchange error:', error);
          toast.error('Failed to connect Sharekhan. Please try again.');
          return;
        }

        if (data?.success) {
          console.log('Sharekhan OAuth: Token exchanged successfully');
          toast.success('Sharekhan connected successfully!');
        } else {
          console.error('Sharekhan OAuth exchange failed:', data?.error);
          toast.error(data?.error || 'Failed to connect Sharekhan');
        }
      } catch (err) {
        console.error('Sharekhan OAuth callback error:', err);
        toast.error('Failed to complete Sharekhan authentication');
      } finally {
        // Clean URL by removing request_token
        const url = new URL(window.location.href);
        url.searchParams.delete('request_token');
        window.history.replaceState({}, document.title, url.pathname + url.search);
      }
    };

    handleOAuthCallback();
  }, []);
};
