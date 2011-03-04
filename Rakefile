require 'rubygems'
require 'logger'
require './twtrk.rb'

desc "Cron job to sync twitter to plurk"
task :cron do
  logger = Logger.new(STDOUT)
  logger.info "start to sync for all users"

  User.all.each do |user|
    logger.info "syncing user #{user.twitter_username} -> #{user.plurk_username}"
    next unless user.should_sync
    synced_twits = 0
    begin
      twitter_api_info = @@oauth_info.merge({
        :token => user.twitter_token,
        :secret => user.twitter_secret
      })
      if ENV['APIGEE_TWITTER_API_ENDPOINT']
        twitter_api_info.merge!({
          :proxy => "http://#{ENV['APIGEE_TWITTER_API_ENDPOINT']}"
        })
      end
      twitter = TwitterOAuth::Client.new(twitter_api_info)
      if user.last_synced_twit_id.nil?
        logger.info "first time sync"
        # this is user's first time syncing.
        # will record last twitter id, but won't sync.
        tl = twitter.user_timeline
        user.last_synced_twit_id = tl[0]["id_str"]
        logger.info "last twit id: #{user.last_synced_twit_id}"
        user.save
        user.sync_logs << SyncLog.create(:result => true, :synced_twits => -1, :last_synced_twit_id => user.last_synced_twit_id)
      else
        # now we should do the sync!
        logger.info "syncing from #{user.last_synced_twit_id}"
        plurk = Plurk.new
        plurk.login(user.plurk_username, user.plurk_password)
        tl = twitter.user_timeline(:since_id => user.last_synced_twit_id, :include_rts => (user.include_rts || false)) || []
        tl.reverse.each do |twit|
          logger.info "#{twit["id"]}: #{twit["text"]}"
          if twit["text"].strip =~ /^@[\w]+ /
            logger.info "  this is a mention tweet, skip."
            next
          end
          plurk.post(twit["text"])
          synced_twits += 1
          user.last_synced_twit_id = twit["id_str"]
          user.save
        end
        logger.info "sync complete, synced_twits = #{synced_twits}"
        user.sync_logs << SyncLog.create(:result => true, :synced_twits => synced_twits, :last_synced_twit_id => user.last_synced_twit_id)
      end
    rescue Exception
      logger.error $!.inspect
      logger.error $!.backtrace.join("\n")
      user.sync_logs << SyncLog.create(:result => false, :synced_twits => synced_twits, :error => "#{$!.message}\n#{$!.backtrace.join("\n")}")
    end
  end
end
