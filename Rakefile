require 'rubygems'
require 'bundler/setup'

begin
  require 'vlad'
  require 'vlad-extras'
  Vlad.load(:app => nil, :type => nil, :scm => :git, :web => :nginx)
rescue LoadError
  puts "Could not load Vlad - please run 'bundle install'"
end

begin
  require 'couchrest'
  DB_URL = 'http://127.0.0.1:5984/codeshelver'

  namespace :db do
    desc "Sets up #{DB_URL}"
    task :setup do |t|
      db = CouchRest.database!(DB_URL)
      # shelve
      db.save_doc({
        "_id" => "_design/shelve",
        :views => {
          :by_user_id => {
            :map => "function(doc) { emit([doc.user.id], doc); }"
          },
          :by_user_id_and_tag => {
            :map => "function(doc) { for(var i in doc.tags) { emit([doc.user.id, doc.tags[i]], doc); } }"
          },
          :by_user_login => {
            :map => "function(doc) { emit([doc.user.login], doc); }"
          },
          :by_user_login_and_tag => {
            :map => "function(doc) { for(var i in doc.tags) { emit([doc.user.login, doc.tags[i]], doc); } }"
          }
        }
      })
      # repos
      db.save_doc({
        "_id" => "_design/repos",
        :views => {
          :popular => {
            :map => "function(doc) { emit([doc.repo.owner, doc.repo.name], 1); }",
            :reduce => "function (key, values, rereduce) { return sum(values); }"
          },
          :popular_tagged => {
            :map => "function(doc) { for(var i in doc.tags) { emit([doc.tags[i], doc.repo.owner, doc.repo.name], 1); } }",
            :reduce => "function (key, values, rereduce) { return sum(values); }"
          },
          :users => {
            :map => "function(doc) { emit([doc.repo.owner, doc.repo.name], doc); }"
          }
        }
      })
      # tags
      db.save_doc({
        "_id" => "_design/tags",
        :views => {
          :popular => {
            :map => "function(doc) { for(var i in doc.tags) { emit(doc.tags[i], 1); } }",
            :reduce => "function (key, values, rereduce) { return sum(values); }"
          }
        }
      })
    end
    desc "Deletes #{DB_URL}"
    task :delete do |t|
      CouchRest.database(DB_URL).delete!
    end
    namespace :maintenance do
      desc "Cleans up cases where repo owners got stored as info hashes instead of their login"
      task :clean_repo_owners do |t|
        cleaned = 0
        db = CouchRest.database!(DB_URL)
        db.documents['rows'].each do |doc|
          if doc['id'].to_i > 0 && d = db.get(doc['id'])
            if d['repo'] && d['repo']['owner'].is_a?(Hash)
              d['repo']['owner'] = d['repo']['owner']['login']
              cleaned += 1 if d.save
            end
          end
        end
        puts "Cleaned #{cleaned} docs"
      end
    end
  end
rescue LoadError
  puts "Could not load CouchRest - please run 'bundle install'"
end
