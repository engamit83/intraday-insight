import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useSharekhanCallback = () => {
  const hasProcessed = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleOAuthCallback = async () => {
      // Prevent double processing
      if (hasProcessed.current) return;

      const urlParams = new URLSearchParams(window.location.search);
      const requestToken = urlParams.get('request_token');

      if (!requestToken) return;

      hasProcessed.current = true;

      // Show loading toast - indicate session restoration
      const loadingToast = toast.loading('Restoring Session & Connecting...');

      try {
        console.log('Sharekhan OAuth: Extracting request_token...');

        // Wait for session to hydrate with retry logic (3 attempts, 500ms apart)
        let user = null;
        const maxRetries = 3;
        const retryDelay = 500;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          console.log(`Sharekhan OAuth: Attempt ${attempt}/${maxRetries} to get session...`);
          
          const { data: { session } } = await supabase.auth.getSession();
          
          if (session?.user) {
            user = session.user;
            console.log('Sharekhan OAuth: Session found for user:', user.id);
            break;
          }

          if (attempt < maxRetries) {
            console.log(`Sharekhan OAuth: No session yet, waiting ${retryDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
          }
        }

        if (!user?.id) {
          console.error('Sharekhan OAuth: No logged-in user found after retries');
          toast.dismiss(loadingToast);
          toast.error('Please log in before connecting Sharekhan');
          return;
        }

        console.log('Sharekhan OAuth: Exchanging token for user:', user.id);

        const { data, error } = await supabase.functions.invoke('sharekhan-auth', {
          body: {
            action: 'exchange-token',
            request_token: requestToken,
            user_id: user.id
          }
        });

        if (error) {
          console.error('Sharekhan OAuth exchange error:', error);
          toast.dismiss(loadingToast);
          toast.error('Failed to connect Sharekhan. Please try again.');
          return;
        }

        if (data?.success) {
          console.log('Sharekhan OAuth: Token exchanged successfully');
          toast.dismiss(loadingToast);
          toast.success('Broker Connected! Starting Master Sync...');

          // Trigger scrip master sync with the new access token
          console.log('Sharekhan OAuth: Triggering scrip master sync...');
          toast.loading('Syncing stock master data...', { id: 'scrip-sync' });

          const { data: syncData, error: syncError } = await supabase.functions.invoke('scrip-master-sync', {
            body: {
              action: 'sync_master',
              accessToken: data.accessToken
            }
          });

          if (syncError) {
            console.error('Scrip master sync error:', syncError);
            toast.dismiss('scrip-sync');
            toast.warning('Connected but master sync failed. You can retry from Settings.');
          } else {
            console.log('Scrip master sync completed:', syncData);
            toast.dismiss('scrip-sync');
            toast.success(`Synced ${syncData?.processed || 0} stocks from Sharekhan`);
          }

          // Navigate to settings page after successful connection
          navigate('/settings');
        } else {
          console.error('Sharekhan OAuth exchange failed:', data?.error);
          toast.dismiss(loadingToast);
          toast.error(data?.error || 'Failed to connect Sharekhan');
        }
      } catch (err) {
        console.error('Sharekhan OAuth callback error:', err);
        toast.dismiss();
        toast.error('Failed to complete Sharekhan authentication');
      } finally {
        // Clean URL by removing request_token
        const url = new URL(window.location.href);
        url.searchParams.delete('request_token');
        window.history.replaceState({}, document.title, url.pathname + url.search);
      }
    };

    handleOAuthCallback();
  }, [navigate]);
};
