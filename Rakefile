require "rubygems"
require "bundler/setup"

begin
  require 'vlad'
  require 'vlad-extras'
  Vlad.load(:app => nil, :type => :nodejs, :scm => :git, :web => :nginx)
rescue LoadError
  puts "Could not load Vlad - please run 'bundle install'"
end

begin
  require 'couchrest'
  
  DB_URL = 'http://127.0.0.1:5984/codeshelver'
  
  namespace :db do
    task :setup do
      @db = CouchRest.database!(DB_URL)
      # shelve
      @db.save_doc({
        "_id" => "_design/shelve",
        :views => {
          :by_user_id => {
            :map => "function(doc) { emit([doc.user.id], doc); }"
          },
          :by_user_id_and_tag => {
            :map => "function(doc) { for(var i in doc.tags) { emit([doc.user.id, doc.tags[i]], doc); } }"
          }
        }
      })
      # repos
      @db.save_doc({
        "_id" => "_design/repos",
        :views => {
          :popular => {
            :map => "function(doc) { emit([doc.repo.owner, doc.repo.name], 1); }",
            :reduce => "function (key, values, rereduce) { return sum(values); }"
          },
          :popular_tagged => {
            :map => "function(doc) { for(var i in doc.tags) { emit([doc.tags[i], doc.repo.owner, doc.repo.name], 1); } }",
            :reduce => "function (key, values, rereduce) { return sum(values); }"
          }
        }
      })
      # tags
      @db.save_doc({
        "_id" => "_design/tags",
        :views => {
          :popular => {
            :map => "function(doc) { for(var i in doc.tags) { emit(doc.tags[i], 1); } }",
            :reduce => "function (key, values, rereduce) { return sum(values); }"
          }
        }
      })
    end
    task :delete do
      CouchRest.database(DB_URL).delete!
    end
  end
rescue LoadError
  puts "Could not load CouchRest - please run 'bundle install'"
end


