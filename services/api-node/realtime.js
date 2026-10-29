function configureRealtime(io, supabase) {
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== 'string' || !token.trim()) {
      return next(new Error('Access token required'));
    }

    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user?.id) return next(new Error('Invalid token'));

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      if (profileError) return next(new Error('Profile verification failed'));

      socket.data.userId = user.id;
      socket.data.isCoach = profile?.role === 'coach';
      next();
    } catch {
      next(new Error('Token verification failed'));
    }
  });

  io.on('connection', (socket) => {
    const { userId, isCoach } = socket.data;
    socket.join(`user_${userId}`);
    if (isCoach) socket.join(`coach_${userId}`);

    // Compatibility events only acknowledge the caller's verified rooms.
    socket.on('join_user_room', (id, ack) => {
      if (typeof ack === 'function') ack({ success: id === userId });
    });
    socket.on('join_coach_room', (id, ack) => {
      if (typeof ack === 'function') ack({ success: id === userId && isCoach });
    });
  });
}

module.exports = { configureRealtime };
