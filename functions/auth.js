const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  console.log('--- Auth Function Started ---');
  console.log('Node Version:', process.version);
  console.log('Environment Debug:', {
    hasUrl: !!process.env.SUPABASE_URL,
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasNetlifyUrl: !!process.env.URL
  });

  let supabase;
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase environment variables');
    }
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  } catch (initError) {
    console.error('Supabase Initialization Error:', initError);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to initialize database client: ' + initError.message }),
    };
  }

  console.log('Auth function called with event:', {
    path: event.path,
    httpMethod: event.httpMethod,
    headers: event.headers
  });

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const { action, email, password, token } = body;

    // Detect Site URL for redirects
    const referer = event.headers.referer || '';
    const origin = event.headers.origin || '';

    // Priority: 1. Netlify URL env, 2. Origin header, 3. Referer header, 4. Fallback
    let siteUrl = process.env.URL;

    if (!siteUrl) {
      if (origin) {
        siteUrl = origin;
      } else if (referer) {
        try {
          siteUrl = new URL(referer).origin;
        } catch (e) {
          siteUrl = 'http://localhost:8888';
        }
      } else {
        siteUrl = 'http://localhost:8888';
      }
    }

    // Ensure siteUrl has a protocol and no trailing slash
    if (siteUrl && !siteUrl.startsWith('http')) {
      siteUrl = `https://${siteUrl}`;
    }
    siteUrl = siteUrl.replace(/\/$/, '');

    console.log('Detected Site URL for OAuth:', siteUrl);
    console.log('Parsed action:', action);

    let result;

    if (action === 'signup') {
      // 1. Create User
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      });
      if (error) throw error;

      // 2. Create entry in our custom 'profiles' table
      const { error: profileError } = await supabase.from('profiles').insert([
        { id: data.user.id, email: email, role: 'user' }
      ]);

      if (profileError) {
        // Log but don't fail, as auth user is created
        console.error("Signup Profile Creation Error:", profileError);
      }
      result = { message: "User created successfully" };

    } else if (action === 'login') {
      // Sign in and get the session
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;

      result = {
        token: data.session.access_token,
        user: data.user
      };

      // Fetch role from profiles table
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      if (profile) result.role = profile.role;

    } else if (action === 'verify-admin') {
      // Verify admin status using the JWT token
      if (!token) {
        return {
          statusCode: 401,
          body: JSON.stringify({ error: 'No token provided' }),
        };
      }

      try {
        // Verify the JWT token and get user from it
        const { data: { user }, error: userError } = await supabase.auth.getUser(token);

        if (userError || !user) {
          return {
            statusCode: 401,
            body: JSON.stringify({ error: 'Invalid token' }),
          };
        }

        // Get user profile to check role
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (profileError) {
          return {
            statusCode: 401,
            body: JSON.stringify({ error: 'Profile not found' }),
          };
        }

        result = {
          is_admin: profile && profile.role === 'admin',
          role: profile ? profile.role : 'user'
        };

      } catch (verifyError) {
        return {
          statusCode: 401,
          body: JSON.stringify({ error: 'Token verification failed' }),
        };
      }
    } else if (action === 'reset-password') {
      // Send password reset email
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${siteUrl}/reset-password.html`
      });

      if (error) throw error;

      result = { message: 'Password reset email sent successfully' };

    } else if (action === 'update-password') {
      // Update password with reset token
      if (!token) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Reset token is required' }),
        };
      }

      const { data, error } = await supabase.auth.updateUser({
        password: body.new_password
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (error) throw error;

      result = { message: 'Password updated successfully' };

    } else if (action === 'google-login') {
      // Initiate Google OAuth
      console.log('Initiating Google OAuth with siteUrl:', siteUrl);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${siteUrl}/auth-callback.html`,
          queryParams: {
            prompt: 'select_account'
          }
        }
      });

      if (error) {
        console.error('Supabase OAuth error:', error);
        throw error;
      }

      console.log('Supabase OAuth response data:', data);

      if (!data || !data.url) {
        console.error('No URL returned from Supabase OAuth initiation');
        throw new Error('Supabase failed to generate an OAuth URL. Check your Google provider settings in the Supabase Dashboard.');
      }

      result = { url: data.url };

    } else if (action === 'get-user-details') {
      // Verify token and get user details (including profile)
      if (!token) throw new Error('No token provided');

      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      if (userError || !user) throw new Error('Invalid or expired session');

      // Check if profile exists, if not create one
      let { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!profile) {
        // Create profile for new Google user
        const { data: newProfile, error: createError } = await supabase.from('profiles').insert([
          { id: user.id, email: user.email, role: 'user' }
        ]).select().single();

        if (createError) console.error("Profile creation error:", createError);
        profile = newProfile;
      }

      result = {
        user: user,
        role: profile ? profile.role : 'user'
      };

    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Unknown action: ' + action }),
      };
    }

    console.log('Returning result:', result);
    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error('Auth function error:', error);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: error.message || 'Unknown error' }),
    };
  }
};