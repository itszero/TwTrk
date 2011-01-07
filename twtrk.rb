require 'rubygems'
require 'sinatra'
require 'json'
require 'twitter_oauth'
require 'dm-core'
require 'dm-timestamps'

class User
  include DataMapper::Resource
  
  property :id, Serial
  property :twitter_username, String
  property :twitter_token, String
  property :twitter_secret, String
  property :created_at, DateTime
  property :updated_at, DateTime
end

@@oauth_info = YAML::load(File.read('oauth.yml'))
use Rack::Session::Memcache, {
  :namespace => "TwTrk_session",
  :memcache_server => 'localhost:11211'
}

before do
  if session.empty?
    session["user_state"] = 'guest'
    session["show_msg"] = ""
    session["username"] = ""
  end
end

get '/' do
  redirect '/index.html'
end

get '/get_status' do
  {
    'user_state' => session["user_state"],
    'show_msg' => session['show_msg'],
    'username' => session['username']
  }.to_json
  session['show_msg'] = ""
end

get '/twitter_auth' do
  client = TwitterOAuth::Client.new(@@oauth_info)
  token_req = client.request_token(:oauth_callback => "http://#{request.host}/twitter_auth_cb")
  session['token_req'] = token_req
  redirect token_req.authorize_url
end

get '/twitter_auth_cb' do
  client = TwitterOAuth::Client.new(@@oauth_info)
  token_req = session['token_req']
  client.authorize(
    token_req.token,
    token_req.secret,
    :oauth_verifier => params[:oauth_verifier]
  )
  if client.authorized?
    session['user_state'] = "authed"
    session['username'] = client.username
  else
    session['show_msg'] = "TWITTER_AUTH_FAILED"
  end
  redirect '/'
end