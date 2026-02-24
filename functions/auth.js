const { createClient } = require('@supabase/supabase-js');

function validatePasswordServer(password) {
  if (!password) return { isValid: false, message: 'Password is required' };

  const requirements = [
    { regex: /.{8,}/, message: 'at least 8 characters' },
    { regex: /[A-Z]/, message: 'one uppercase letter' },
    { regex: /[a-z]/, message: 'one lowercase letter' },
    { regex: /[0-9]/, message: 'one number' },
    { regex: /[^A-Za-z0-9]/, message: 'one special character' }
  ];

  const failed = requirements.filter(req => !req.regex.test(password));

  if (failed.length > 0) {
    return {
      isValid: false,
      message: 'Password must have: ' + failed.map(r => r.message).join(', ')
    };
  }

  return { isValid: true };
}

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
    const { action, email, password, token, otp } = body;

    const referer = event.headers.referer || '';
    const origin = event.headers.origin || '';

    // Priority: 1. Origin header, 2. Referer header, 3. Netlify URL env, 4. Fallback
    let siteUrl = origin;

    if (!siteUrl && referer) {
      try {
        siteUrl = new URL(referer).origin;
      } catch (e) {
        siteUrl = process.env.URL || 'http://localhost:8888';
      }
    } else if (!siteUrl) {
      siteUrl = process.env.URL || 'http://localhost:8888';
    }

    // Ensure siteUrl has a protocol and no trailing slash
    if (siteUrl && !siteUrl.startsWith('http')) {
      siteUrl = `https://${siteUrl}`;
    }
    siteUrl = siteUrl.replace(/\/$/, '');

    console.log('Detected Site URL for Redirects:', siteUrl);
    console.log('Parsed action:', action);

    let result;

    if (action === 'signup') {
      // 1. Check if user already exists
      console.log(`Checking if user exists: ${email}`);
      const { data: userList, error: listError } = await supabase.auth.admin.listUsers();

      if (listError) {
        console.warn('Could not check if user exists:', listError.message);
      } else {
        const existingUser = userList.users.find(u => u.email === email);
        if (existingUser) {
          console.log(`User ${email} already registered.`);
          return {
            statusCode: 400,
            body: JSON.stringify({ error: 'User already registered' }),
          };
        }
      }

      // 2. Validate Password Strength
      const passwordValidation = validatePasswordServer(password);
      if (!passwordValidation.isValid) {
        console.log(`Password validation failed for: ${email}`);
        return {
          statusCode: 400,
          body: JSON.stringify({ error: passwordValidation.message }),
        };
      }

      // 3. Initiate Signup (this sends the OTP/Verification email automatically)
      console.log(`Initiating signup for: ${email}`);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${siteUrl}/auth-callback.html`
        }
      });

      if (error) {
        console.error('Supabase Signup Error:', error);
        throw error;
      }

      console.log('Signup initiated, verification code sent');
      result = { message: "Verification code sent to email" };

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

    } else if (action === 'send-otp') {
      // Send OTP to email
      if (!email) throw new Error('Email is required for OTP');

      console.log(`Attempting to send OTP to: ${email} with redirectTo: ${siteUrl}/auth-callback.html`);
      const { data, error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${siteUrl}/auth-callback.html`
        }
      });

      if (error) {
        console.error('Supabase OTP Error:', error);
        throw error;
      }
      console.log('OTP request sent successfully');
      result = { message: 'OTP sent successfully' };

    } else if (action === 'verify-otp') {
      // Verify OTP and sign in
      if (!email || !otp) {
        console.error('Verification failed: Missing email or OTP/Token');
        throw new Error('Email and OTP/Token are required');
      }

      console.log(`Verifying OTP for ${email}`);

      let verificationResult;
      const verifyTypes = ['email', 'signup', 'magiclink'];
      let lastError;

      for (const type of verifyTypes) {
        console.log(`Trying verification with type: ${type}`);
        const { data, error } = await supabase.auth.verifyOtp({
          email,
          token: otp,
          type: type
        });

        if (!error && data?.session) {
          verificationResult = data;
          console.log(`Verification successful with type: ${type}`);
          break;
        }
        lastError = error;
        if (error) console.warn(`Verification with type ${type} failed:`, error.message);
      }

      if (!verificationResult) {
        throw new Error(lastError?.message || 'Verification failed: No valid session returned');
      }

      result = {
        token: verificationResult.session.access_token,
        user: verificationResult.user
      };

      // Fetch role from profiles table, or create if missing
      let { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', verificationResult.user.id)
        .single();

      if (!profile) {
        console.log('No profile found for OTP user, creating one...');
        const { data: newProfile, error: profileError } = await supabase
          .from('profiles')
          .insert([{ id: verificationResult.user.id, email: verificationResult.user.email, role: 'user' }])
          .select('*')
          .single();

        if (profileError) {
          console.error('Error creating profile for OTP user:', profileError);
          result.role = 'user'; // Fallback
        } else {
          profile = newProfile;
          result.role = profile.role;
        }
      } else {
        result.role = profile.role;
      }

    } else if (action === 'exchange-code') {
      // Exchange PKCE code for session
      if (!token) throw new Error('Code (token) is required');

      console.log('Exchanging code for session...');
      const { data, error } = await supabase.auth.exchangeCodeForSession(token);

      if (error) {
        console.error('Supabase code exchange error:', error);
        throw error;
      }

      result = {
        token: data.session.access_token,
        user: data.user
      };

      // Fetch role from profiles table, or create if missing
      let { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (!profile) {
        console.log('No profile found for exchanged user, creating one...');
        const { data: newProfile, error: profileError } = await supabase
          .from('profiles')
          .insert([{ id: data.user.id, email: data.user.email, role: 'user' }])
          .select('*')
          .single();

        if (profileError) {
          console.error('Error creating profile for code exchange user:', profileError);
          result.role = 'user';
        } else {
          profile = newProfile;
          result.role = profile.role;
        }
      } else {
        result.role = profile.role;
      }

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