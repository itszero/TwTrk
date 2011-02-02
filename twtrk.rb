# encoding: utf-8
require 'rubygems'
require 'bundler'

# setup mongo connections
require 'uri'
mongo_uri = URI.parse(ENV['MONGOHQ_URL'] || "mongodb://localhost/twtrk")
puts "Connecting to mogno URI: #{mongo_uri}"
ENV['MONGOID_HOST'] = mongo_uri.host
ENV['MONGOID_PORT'] = mongo_uri.port.to_s if mongo_uri.port
if mongo_uri.user
  ENV['MONGOID_USERNAME'] = mongo_uri.user
  ENV['MONGOID_PASSWORD'] = mongo_uri.password
end
ENV['MONGOID_DATABASE'] = mongo_uri.path.gsub("/", "")

# then load gems
Bundler.require

# load my hack of Rack::Session::Memcache to use Dalli lib
require './dalli_session.rb'

class SyncLog
  include Mongoid::Document
  include Mongoid::Timestamps
  
  referenced_in :user, :inverse_of => :sync_log
  field :result, :type => Boolean
  field :synced_twits, :type => Integer, :default => 0
  field :last_synced_twit_id, :type => Integer
  field :error, :type => String
end

class User
  include Mongoid::Document
  include Mongoid::Timestamps
  
  field :twitter_username, :type => String
  field :twitter_token, :type => String
  field :twitter_secret, :type => String
  field :plurk_username, :type => String
  field :plurk_password, :type => String
  field :should_sync, :type => Boolean, :default => false
  field :last_synced_twit_id, :type => Integer

  references_many :sync_logs
end

class Plurk
  def initialize
    @api_ep = "http://www.plurk.com/API"
    @http = Mechanize.new
  end
  
  def login(username, password)
    JSON.parse(@http.get("#{api_ep}/Users/login?api_key=#{PLURK_API_KEY}&username=#{username}&password=#{password}").body)
  end
  
  def post(content, qualifier="says")
    JSON.parse(@http.get("#{api_ep}/Timeline/plurkAdd?api_key=#{PLURK_API_KEY}&content=#{content}&qualifier=#{qualifier}").body)
  end
  
  def api_ep
    @api_ep
  end
end

@@oauth_info = YAML::load(File.read('oauth.yml'))
PLURK_API_KEY = @@oauth_info[:plurk_api_key]
use Rack::Session::DalliMemcache, {
  :namespace => "TwTrk_session"
}

before do
  @user = User.find(session['user_id']) if session['user_id']
  if session["user_state"].nil? || @user.nil?
    session['user_id'] = nil
    session["user_state"] = 'guest'
    session["show_msg"] = ""
    session["username"] = ""
  end
end

after do
  session['user_id'] = @user.id if @user
end

get '/' do
  if request.secure?
    redirect "https://#{request.host}/index.html"
  else
    redirect '/index.html'
  end
end

get '/get_status' do
  {
    'user_state' => session['user_state'],
    'show_msg' => session['show_msg'],
    'username' => session['username']
  }.to_json
end

get '/twitter_auth' do
  client = TwitterOAuth::Client.new(@@oauth_info)
  token_req = client.request_token(:oauth_callback => "http#{request.secure? ? "s" : ""}://#{request.host}/twitter_auth_cb")
  session['token_req'] = token_req
  redirect token_req.authorize_url
end

get '/twitter_auth_cb' do
  client = TwitterOAuth::Client.new(@@oauth_info)
  token_req = session['token_req']
  session['token_req'] = nil
  access_token = nil
  begin
    access_token = client.authorize(
      token_req.token,
      token_req.secret,
      :oauth_verifier => params[:oauth_verifier]
    )
  rescue OAuth::Unauthorized
    # Let rest of code handle it.
  end
  if client.authorized?
    session['user_state'] = "authed"
    uinfo = client.info
    session['username'] = uinfo['name']
    if u = User.where(:twitter_username => uinfo['screen_name'])[0]
      u.update_attributes(
        :twitter_token => access_token.token,
        :twitter_secret => access_token.secret
      )
    else
      u = User.new(
        :twitter_username => uinfo['screen_name'],
        :twitter_token => access_token.token,
        :twitter_secret => access_token.secret
      )
    end
    u.save
    @user = u
  else
    session['show_msg'] = "TWITTER_AUTH_FAILED"
  end
  if request.secure?
    redirect "https://#{request.host}/"
  else
    redirect '/'
  end
end

post '/plurk_auth' do
  data = Plurk.new.login(params[:username], params[:password])
  
  if @user && data["user_info"]
    @user.plurk_username = params[:username]
    @user.plurk_password = params[:password]
    @user.should_sync = true
    @user.save
    {:status => 'ok'}.to_json
  else
    status 503
    {:status => 'err'}.to_json
  end
end

get '/set_sync' do
  if @user
    if @user.plurk_username && @user.plurk_password
      @user.should_sync = (params[:val] == "on" ? true : false)
      @user.save
      {:status => 'ok'}.to_json
    else
      {:status => 'err', :msg => 'NEED_PLURK_CREDENTIALS'}.to_json
    end
  else
    status 503
    {:status => 'err'}.to_json
  end    
end

get '/info' do
  if @user
    {
      :status => 'ok',
      :twitter_username => @user.twitter_username,
      :plurk_username => (@user.plurk_username || "尚未登記"),
      :should_sync => @user.should_sync,
      :joined_at => @user.created_at.strftime("%Y/%m/%d"),
      :logs => @user.sync_logs.desc(:created_at).limit(5).map { |log|
        {
          :result => log.result,
          :synced_twits => log.synced_twits < 0 ? "  第一次" : sprintf("%8d", log.synced_twits),
          :synced_at => log.created_at.strftime("%Y/%m/%d %0H:%0M:%0S")
        }
      }
    }.to_json
  else
    status 503
    {:status => 'err', :session => session}.to_json
  end 
end

get '/logout' do
  @user = nil
  session.clear
  if request.secure?
    redirect "https://#{request.host}/"
  else
    redirect '/'
  end
end