import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useSharekhanCallback = () => {
  const hasProcessed = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const requestToken = urlParams.get('request_token');

    // Exit early if no request_token in URL
    if (!requestToken) return;

    // Prevent double processing
    if (hasProcessed.current) return;

    const cleanUrl = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete('request_token');
      window.history.replaceState({}, document.title, url.pathname + url.search);
    };

    const REDIRECT_URI = 'https://id-preview--0b7f6ea9-fd3b-48da-b4ea-ee41af1cab07.lovable.app/';
    
    const processToken = async (userId: string) => {
      const loadingToast = toast.loading('Connecting to Sharekhan...');

      try {
        console.log('Sharekhan OAuth: Exchanging token for user:', userId);

        // Step 1: Exchange request_token for access token
        const { data, error } = await supabase.functions.invoke('sharekhan-auth', {
          body: {
            action: 'exchange-token',
            request_token: requestToken,
            user_id: userId
          }
        });

        if (error) {
          console.error('Sharekhan OAuth exchange error:', error);
          toast.dismiss(loadingToast);
          toast.error(`Broker connection failed: ${error.message}`);
          return;
        }

        if (!data?.success) {
          console.error('Sharekhan OAuth exchange failed:', data?.error);
          toast.dismiss(loadingToast);
          toast.error(data?.error || 'Failed to connect Sharekhan');
          return;
        }

        console.log('Sharekhan OAuth: Token exchanged successfully');

        // Step 2: Save broker data to user_settings
        const { error: upsertError } = await supabase
          .from('user_settings')
          .upsert({
            user_id: userId,
            sharekhan_access_token: data.accessToken,
            sharekhan_refresh_token: data.refreshToken || null,
            sharekhan_token_expiry: data.expiresAt || null,
            sharekhan_token_generated_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });

        if (upsertError) {
          console.error('Failed to save broker data:', upsertError);
          toast.dismiss(loadingToast);
          toast.error('Connected but failed to save settings. Please try again.');
          return;
        }

        console.log('Sharekhan OAuth: Broker data saved to user_settings');
        toast.dismiss(loadingToast);
        toast.success('Broker Connected! Starting Master Sync...');

        // Step 3: Trigger scrip master sync ONLY after successful upsert
        toast.loading('Syncing stock master data...', { id: 'scrip-sync' });

        const { data: syncData, error: syncError } = await supabase.functions.invoke('scrip-master-sync', {
          body: {
            action: 'sync_master',
            accessToken: data.accessToken
          }
        });

        toast.dismiss('scrip-sync');
        if (syncError) {
          console.error('Scrip master sync error:', syncError);
          toast.warning('Connected but master sync failed. Retry from Settings.');
        } else {
          console.log('Scrip master sync completed:', syncData);
          toast.success(`Synced ${syncData?.processed || 0} stocks from Sharekhan`);
        }

        // Step 4: Navigate to settings after all operations complete
        navigate('/settings');

      } catch (err) {
        console.error('Sharekhan OAuth callback error:', err);
        toast.dismiss();
        toast.error('Failed to complete Sharekhan authentication');
      } finally {
        cleanUrl();
      }
    };

    // Use onAuthStateChange to wait for session
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (hasProcessed.current) return;

      if (session?.user) {
        hasProcessed.current = true;
        console.log('Sharekhan OAuth: Session active for user:', session.user.id);
        processToken(session.user.id);
        subscription.unsubscribe();
      }
    });

    // Also check for existing session immediately
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (hasProcessed.current) return;

      if (session?.user) {
        hasProcessed.current = true;
        console.log('Sharekhan OAuth: Existing session found for user:', session.user.id);
        processToken(session.user.id);
        subscription.unsubscribe();
      }
    });

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);
};
