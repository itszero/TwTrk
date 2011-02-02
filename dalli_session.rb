require 'rack/session/abstract/id'
require 'dalli'

module Rack
  module Session
    class DalliMemcache < Abstract::ID
      attr_reader :mutex, :pool
      DEFAULT_OPTIONS = Abstract::ID::DEFAULT_OPTIONS.merge \
        :namespace => 'rack:session',
        :memcache_server => 'localhost:11211'

      def initialize(app, options={})
        super

        @mutex = Mutex.new
        mserv = @default_options[:memcache_server]
        mopts = @default_options
        @namespace = @default_options[:namespace]
        @pool = Dalli::Client.new mserv, mopts
      end

      def generate_sid
        loop do
          sid = super
          break sid unless @pool.get(memcache_key(sid), true)
        end
      end

      def get_session(env, session_id)
        @mutex.lock if env['rack.multithread']
        unless session_id and session = @pool.get(memcache_key(session_id))
          session_id, session = generate_sid, {}
          unless @pool.add(memcache_key(session_id), session)
            raise "Session collision on '#{memcache_key(session_id).inspect}'"
          end
        end
        return [session_id, session]
      rescue Dalli::NetworkError, Errno::ECONNREFUSED
        # MemCache server cannot be contacted
        warn "#{self} is unable to find memcached server."
        warn $!.inspect
        return [ nil, {} ]
      ensure
        @mutex.unlock if @mutex.locked?
      end

      def set_session(env, session_id, new_session, options)
        expiry = options[:expire_after]
        expiry = expiry.nil? ? 0 : expiry + 1

        @mutex.lock if env['rack.multithread']
        if options[:renew] or options[:drop]
          @pool.delete memcache_key(session_id)
          return false if options[:drop]
          session_id = generate_sid
          @pool.add memcache_key(session_id), {} # so we don't worry about cache miss on #set
        end

        @pool.set memcache_key(session_id), new_session, expiry
        return session_id
      rescue Dalli::NetworkError, Errno::ECONNREFUSED
        # MemCache server cannot be contacted
        warn "#{self} is unable to find memcached server."
        warn $!.inspect
        return false
      ensure
        @mutex.unlock if @mutex.locked?
      end
      
      def memcache_key(session_id)
        "#{@namespace}:#{session_id}"
      end
    end    
  end
end
